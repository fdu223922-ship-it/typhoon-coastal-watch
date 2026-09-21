import { validateSnapshot, freshness } from './lib/typhoon.js'
const $ = id => document.getElementById(id)
const text = (id, value) => { $(id).textContent = value ?? '—' }
const fmt = time => time ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(time)) : '—'
const value = n => n ?? '—'
const coords = p => `${Math.abs(p.lat)}°${p.lat >= 0 ? 'N' : 'S'} / ${Math.abs(p.lon)}°${p.lon >= 0 ? 'E' : 'W'}`
const state = { data: null, id: null, selected: 0, zoom: 1, networkError: false, signature: '' }
const storm = () => state.data?.storms.find(s => s.id === state.id)
const forecast = () => storm()?.forecasts.find(f => f.agency === $('agency-select').value)
const points = () => storm() ? [...storm().history, ...($('show-forecast').checked ? forecast()?.points || [] : [])] : []
function svg(tag, attrs, content) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag)
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v))
  if (content !== undefined) e.textContent = content
  return e
}
function renderStatus() {
  const status = state.networkError ? { state: 'error', text: state.data ? '页面读取失败 · 保留上次已加载记录' : '无法读取数据 · 请查看官方原站' } : state.data ? freshness(state.data) : { state: 'unavailable', text: '正在读取数据' }
  text('data-status', status.text)
  $('data-banner').dataset.state = status.state
  const current = storm()?.current
  text('observation-status', current && Date.now() - Date.parse(current.time) > 6 * 3600000 ? '定位已超过 6 小时：下方为源站最后已知记录，请核对官方最新发布。' : current ? `最新定位：${fmt(current.time)}（北京时间）· 路径时间轴不改变上方最新实况。` : '')
}
function renderStorm() {
  const s = storm(), p = s?.current
  for (const button of $('storm-switch').children) button.setAttribute('aria-pressed', String(button.dataset.id === state.id))
  text('storm-name', s?.name); text('storm-strength', p?.strength)
  text('storm-code', s ? `${s.english} · ${s.id}` : '—')
  text('storm-location', p ? `${Math.abs(p.lat)}°${p.lat >= 0 ? 'N' : 'S'}` : '—')
  text('storm-coordinates', p ? `经度 ${Math.abs(p.lon)}°${p.lon >= 0 ? 'E' : 'W'}` : '—')
  text('observation-time', p ? `定位 ${fmt(p.time)} · 北京时间` : '没有可用定位')
  for (const [id, v] of [['storm-direction', p?.direction], ['storm-speed', p?.moveSpeed], ['storm-wind', p?.wind], ['storm-wind-speed', p?.windSpeed], ['storm-pressure', p?.pressure]]) text(id, v)
  const previousAgency = $('agency-select').value
  $('agency-select').replaceChildren()
  for (const group of s?.forecasts || []) $('agency-select').add(new Option(group.agency, group.agency))
  if (s?.forecasts.some(f => f.agency === previousAgency)) $('agency-select').value = previousAgency
  else if (s?.forecasts.some(f => f.agency === '中国')) $('agency-select').value = '中国'
  $('agency-select').disabled = !s?.forecasts.length
  $('show-forecast').disabled = !s?.forecasts.length
  state.selected = Math.max(0, (s?.history.length || 1) - 1); state.zoom = 1
  renderMap(); renderStatus()
}
function renderMap() {
  for (const id of ['graticule', 'history-path', 'forecast-path', 'map-points', 'current-marker', 'selected-marker']) $(id).replaceChildren()
  const s = storm(), all = points(), group = forecast()
  $('track-time').disabled = !all.length
  for (const id of ['zoom-in', 'zoom-out', 'zoom-reset']) $(id).disabled = !all.length
  text('forecast-note', group ? `随 ${fmt(group.basedOn)} 定位附带 · 未单列预报发布时间` : '最新定位未附可用预报')
  text('map-storm-label', s ? `${s.name} · 最新定位 ${fmt(s.current.time)}` : '暂无可用路径')
  text('map-svg-title', s ? `${s.name}台风经纬度路径图` : '暂无可用路径')
  $('track-table').replaceChildren()
  if (!all.length) { for (const id of ['point-detail', 'point-coordinates', 'time-start', 'time-end']) text(id, '—'); return }
  state.selected = Math.min(state.selected, all.length - 1)
  const lons = all.map(p => p.lon), lats = all.map(p => p.lat)
  const minLon = Math.min(...lons) - 2, maxLon = Math.max(...lons) + 2
  const minLat = Math.max(-90, Math.min(...lats) - 2), maxLat = Math.min(90, Math.max(...lats) + 2)
  const project = p => ({ x: 65 + (p.lon - minLon) / (maxLon - minLon) * 640, y: 380 - (p.lat - minLat) / (maxLat - minLat) * 280 })
  $('map-scene').setAttribute('transform', `translate(${400 * (1 - state.zoom)} ${225 * (1 - state.zoom)}) scale(${state.zoom})`)
  for (let i = 0; i <= 4; i++) {
    const x = 65 + 160 * i, y = 100 + 70 * i
    $('graticule').append(svg('path', { d: `M${x} 90V385M60 ${y}H710`, stroke: '#c8dcd8', fill: 'none' }))
    $('graticule').append(svg('text', { x, y: 405, 'text-anchor': 'middle', fill: '#587671', 'font-size': 12 }, `${(minLon + (maxLon - minLon) * i / 4).toFixed(1)}°`))
    $('graticule').append(svg('text', { x: 53, y: y + 4, 'text-anchor': 'end', fill: '#587671', 'font-size': 12 }, `${(maxLat - (maxLat - minLat) * i / 4).toFixed(1)}°`))
  }
  const line = data => data.map(p => { const xy = project(p); return `${xy.x},${xy.y}` }).join(' ')
  $('history-path').append(svg('polyline', { points: line(s.history), fill: 'none', stroke: '#208a7b', 'stroke-width': 3 }))
  if ($('show-forecast').checked && group) $('forecast-path').append(svg('polyline', { points: line([s.current, ...group.points]), fill: 'none', stroke: '#b98248', 'stroke-width': 2.5, 'stroke-dasharray': '7 7' }))
  all.forEach((p, i) => {
    const xy = project(p), isForecast = i >= s.history.length
    $('map-points').append(svg('circle', { cx: xy.x, cy: xy.y, r: 3.5, fill: '#fff', stroke: isForecast ? '#b98248' : '#208a7b', 'stroke-width': 1.5 }))
    const tr = document.createElement('tr'); tr.dataset.selected = String(i === state.selected)
    for (const content of [fmt(p.time), isForecast ? `预报 · ${group.agency}` : i === s.history.length - 1 ? '最新定位' : '历史定位', coords(p), `${value(p.wind)} 级`]) { const td = document.createElement('td'); td.textContent = content; tr.append(td) }
    $('track-table').append(tr)
  })
  const current = project(s.current), selected = project(all[state.selected])
  $('current-marker').append(svg('circle', { cx: current.x, cy: current.y, r: 8, fill: '#208a7b', stroke: '#fff', 'stroke-width': 3 }))
  $('selected-marker').append(svg('circle', { cx: selected.x, cy: selected.y, r: 13, fill: 'none', stroke: '#153d42', 'stroke-width': 2 }))
  $('track-time').max = all.length - 1; $('track-time').value = state.selected
  const chosen = all[state.selected]
  text('point-detail', `${fmt(chosen.time)} · ${state.selected >= s.history.length ? `${group.agency}预报` : '历史定位'}`)
  text('point-coordinates', `${coords(chosen)} · ${value(chosen.wind)} 级 · 风速 ${value(chosen.windSpeed)} 米/秒`)
  text('time-start', fmt(all[0].time)); text('time-end', fmt(all.at(-1).time))
}
function renderData() {
  const data = state.data
  const year = data.lastSuccessAt ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date(data.lastSuccessAt)) : ''
  text('snapshot-time', data.lastSuccessAt ? `${year} ${fmt(data.lastSuccessAt)}` : '尚无成功记录')
  text('attempt-time', `最近尝试 ${fmt(data.lastAttemptAt)}`)
  text('storm-count', `${data.storms.length} 个来源标记的活动台风`)
  $('empty-state').hidden = !!data.storms.length
  text('empty-state', data.lastSuccessAt ? '本次可用快照未列出活动台风；不代表当地没有风雨或预警，请同时核对数据状态与官方发布。' : '尚未取得有效数据，请查看官方原站。')
  if (!data.storms.some(s => s.id === state.id)) state.id = data.storms[0]?.id || null
  $('storm-switch').replaceChildren()
  for (const s of data.storms) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.id = s.id; button.textContent = `${s.name} ${s.english}`
    button.addEventListener('click', () => { state.id = s.id; renderStorm() }); $('storm-switch').append(button)
  }
  renderStorm()
}
async function refresh() {
  try {
    const response = await fetch(`./data/latest.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('数据请求失败')
    const data = validateSnapshot(await response.json()), signature = JSON.stringify(data)
    state.networkError = false
    if (signature !== state.signature) { state.data = data; state.signature = signature; renderData() }
  } catch {
    state.networkError = true
    if (!state.data) { $('empty-state').hidden = false; text('empty-state', '无法加载台风快照，请稍后重试或查看官方原站。'); text('storm-count', '数据不可用') }
  }
  renderStatus()
}
$('agency-select').addEventListener('change', () => { state.selected = storm().history.length - 1; renderMap() })
$('show-forecast').addEventListener('change', renderMap)
$('track-time').addEventListener('input', event => { state.selected = Number(event.target.value); renderMap() })
for (const [id, delta] of [['zoom-in', .25], ['zoom-out', -.25], ['zoom-reset', 0]]) $(id).addEventListener('click', () => { state.zoom = delta ? Math.max(1, Math.min(2, state.zoom + delta)) : 1; renderMap() })
$('region-select').addEventListener('change', event => text('warning-region', event.target.value))
const dialog = $('about-dialog')
document.querySelectorAll('[data-open-about]').forEach(button => button.addEventListener('click', () => dialog.showModal()))
for (const id of ['close-dialog', 'confirm-dialog']) $(id).addEventListener('click', () => dialog.close())
dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close() })
renderMap(); refresh()
setInterval(refresh, 60000)
setInterval(renderStatus, 30000)
