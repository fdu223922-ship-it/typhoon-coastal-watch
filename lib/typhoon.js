export const SOURCE = Object.freeze({
  name: '上海市水务局台风路径发布系统',
  url: 'https://bmxx.swj.sh.gov.cn/typhoon/',
  api: 'https://bmxx.swj.sh.gov.cn/netskip-datax-typhoon/weather/',
  timezone: 'Asia/Shanghai'
})

export function sourceTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('来源时间格式发生变化')
  const iso = value.replace(' ', 'T') + '+08:00'
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed) || new Date(parsed + 8 * 3600000).toISOString().slice(0, 19) !== value.replace(' ', 'T')) throw new Error('来源时间无效')
  return iso
}

export function numberOrNull(value, min = 0, max = 2000) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

const string = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : null

export function parseList(raw) {
  if (!Array.isArray(raw)) throw new Error('台风列表不是数组，拒绝当作无台风')
  const seen = new Set()
  return raw.map(item => {
    if (!item || !/^\d{6,10}$/.test(String(item.tfbh)) || ![0, 1, '0', '1'].includes(item.is_current)) throw new Error('台风列表缺少编号或活动状态')
    const id = String(item.tfbh)
    if (seen.has(id)) throw new Error('台风编号重复')
    seen.add(id)
    return { id, name: string(item.name) || '未命名', english: string(item.ename) || '', active: Number(item.is_current) === 1 }
  })
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object') throw new Error('路径点格式无效')
  const lat = numberOrNull(point.lat, -90, 90)
  const lon = numberOrNull(point.lng, -180, 180)
  if (lat === null || lon === null) throw new Error('路径坐标缺失或越界')
  const windRadii = {}
  for (const level of [7, 10, 12]) {
    const quad = point[`radius${level}_quad`]
    if (quad && typeof quad === 'object') windRadii[level] = Object.fromEntries(['ne', 'se', 'sw', 'nw'].map(key => [key, numberOrNull(quad[key], 0, 3000)]))
  }
  return { time: sourceTime(point.time), lat, lon, wind: numberOrNull(point.power, 0, 30), windSpeed: numberOrNull(point.speed, 0, 150), pressure: numberOrNull(point.pressure, 800, 1100), strength: string(point.strong), moveSpeed: numberOrNull(point.move_speed, 0, 300), direction: string(point.move_dir), windRadii }
}

export function normalizeStorm(item, raw, now = new Date()) {
  if (!Array.isArray(raw) || raw.length !== 1 || String(raw[0]?.tfbh) !== item.id || !Array.isArray(raw[0]?.points) || !raw[0].points.length) throw new Error(`台风 ${item.id} 详情缺失或编号不匹配`)
  const detail = raw[0]
  const history = detail.points.map(normalizePoint).sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  if (new Set(history.map(p => p.time)).size !== history.length) throw new Error('实况时次重复')
  const current = history.at(-1)
  if (Date.parse(current.time) > now.getTime() + 30 * 60000) throw new Error('实况时间异常超前')
  const last = detail.points.find(point => sourceTime(point.time) === current.time)
  const forecasts = []
  if (last.forecast != null && !Array.isArray(last.forecast)) throw new Error('预报结构发生变化')
  for (const group of last.forecast || []) {
    const agency = string(group.sets)
    if (!agency || !Array.isArray(group.points)) throw new Error('预报机构或路径缺失')
    const points = group.points.map(normalizePoint).filter(point => Date.parse(point.time) > Date.parse(current.time)).sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    if (points.length) forecasts.push({ agency, basedOn: current.time, issuedAt: null, points })
  }
  return { ...item, name: string(detail.name) || item.name, english: string(detail.ename) || item.english, history, current, forecasts }
}

export function validateSnapshot(data) {
  if (!data || data.schemaVersion !== 1 || data.mode !== 'live' || data.source?.url !== SOURCE.url || !['ok', 'error'].includes(data.status) || !Array.isArray(data.storms)) throw new Error('快照格式无效')
  if (!Number.isFinite(Date.parse(data.lastAttemptAt))) throw new Error('采集时间缺失')
  if (data.lastSuccessAt !== null && !Number.isFinite(Date.parse(data.lastSuccessAt))) throw new Error('成功时间无效')
  if (data.lastSuccessAt === null && data.storms.length) throw new Error('有数据但没有成功采集时间')
  if (data.status === 'ok' && data.lastSuccessAt === null) throw new Error('成功快照缺少成功时间')
  for (const storm of data.storms) {
    if (!storm.id || !storm.name || !Array.isArray(storm.history) || !storm.history.length || !Array.isArray(storm.forecasts) || !storm.current) throw new Error('快照台风结构无效')
    for (const point of [...storm.history, storm.current, ...storm.forecasts.flatMap(f => f.points)]) {
      if (!Number.isFinite(point.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point.lon) || Math.abs(point.lon) > 180 || !Number.isFinite(Date.parse(point.time))) throw new Error('快照坐标或时间无效')
    }
  }
  return data
}

export function failedSnapshot(previous, now, message) {
  return { schemaVersion: 1, mode: 'live', source: SOURCE, status: 'error', lastAttemptAt: now.toISOString(), lastSuccessAt: previous?.lastSuccessAt || null, error: String(message).slice(0, 240), storms: previous?.storms || [], warnings: { status: 'not_connected', items: [] } }
}

export function freshness(data, now = Date.now()) {
  if (!data.lastSuccessAt) return { state: 'unavailable', text: '尚未取得实况数据' }
  if (data.status === 'error') return { state: 'error', text: '最近采集失败 · 展示上次成功记录' }
  if (now - Date.parse(data.lastSuccessAt) > 45 * 60000) return { state: 'stale', text: '采集已延迟 · 请核对官方最新发布' }
  return { state: 'ok', text: '已连接上海台风路径数据源' }
}
