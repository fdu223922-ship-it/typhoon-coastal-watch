import { readFile, writeFile, mkdir, rename, appendFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { SOURCE, parseList, normalizeStorm, validateSnapshot, failedSnapshot } from '../lib/typhoon.js'

const root = new URL('../', import.meta.url)
const output = new URL('data/latest.json', root)

export async function fetchJSON(url, { fetcher = fetch, retries = 2 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', 'User-Agent': 'TyphoonCoastalWatch/1.0 (+https://github.com/fdu223922-ship-it/typhoon-coastal-watch)' } })
      if (!response.ok) throw new Error(`来源 HTTP ${response.status}`)
      const body = await response.text()
      if (body.length > 5_000_000) throw new Error('来源响应超过大小限制')
      return JSON.parse(body)
    } catch (error) {
      lastError = error
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }
  throw lastError
}

export async function collect({ now = new Date(), get = fetchJSON } = {}) {
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: SOURCE.timezone }).format(now))
  // 上年列表仅取仍活动的台风，防止跨年风暴丢失；不批量抓取历史详情。
  const items = new Map()
  for (const y of [year, year - 1]) {
    const raw = await get(`${SOURCE.api}getTfByYear?year=${y}`)
    for (const item of parseList(raw)) if (item.active) items.set(item.id, item)
  }
  if (items.size > 20) throw new Error('活动台风数量异常，停止采集')
  const storms = []
  for (const item of items.values()) {
    const detail = await get(`${SOURCE.api}getTfDetail?tfbh=${encodeURIComponent(item.id)}`)
    storms.push(normalizeStorm(item, detail, now))
  }
  storms.sort((a, b) => Date.parse(b.current.time) - Date.parse(a.current.time))
  const completed = new Date().toISOString()
  return validateSnapshot({ schemaVersion: 1, mode: 'live', source: SOURCE, status: 'ok', lastAttemptAt: completed, lastSuccessAt: completed, error: null, storms, warnings: { status: 'not_connected', items: [] } })
}

export async function main() {
  let previous = null
  try { previous = validateSnapshot(JSON.parse(await readFile(output, 'utf8'))) } catch { /* 首次运行允许没有快照。 */ }
  // 从上次部署读取最新成功记录；失败时退回仓库内的启动快照。
  if (process.env.PUBLISHED_DATA_URL) {
    const url = new URL(process.env.PUBLISHED_DATA_URL)
    if (url.protocol !== 'https:' || url.hostname !== 'fdu223922-ship-it.github.io') throw new Error('上次发布地址必须是本项目 GitHub Pages')
    try {
      const published = validateSnapshot(await fetchJSON(url.href, { retries: 0 }))
      if (!previous || Date.parse(published.lastSuccessAt || 0) > Date.parse(previous.lastSuccessAt || 0)) previous = published
    } catch (error) { console.log(`未恢复线上快照：${error.message}`) }
  }
  let snapshot
  try { snapshot = await collect() }
  catch (error) {
    snapshot = failedSnapshot(previous, new Date(), error.message)
    console.error(`采集失败，保留上次数据：${error.message}`)
    process.exitCode = 1
  }
  await mkdir(new URL('data/', root), { recursive: true })
  const temporary = new URL('data/latest.json.tmp', root)
  await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n')
  await rename(temporary, output)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `status=${snapshot.status}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## 台风数据采集\n\n- 状态：${snapshot.status}\n- 本次尝试：${snapshot.lastAttemptAt}\n- 最近成功：${snapshot.lastSuccessAt || '无'}\n- 台风条数：${snapshot.storms.length}\n- 来源：[上海市水务局台风路径系统](${SOURCE.url})\n- 地区预警：未接入，不推算或生成预警。\n`)
  console.log(JSON.stringify({ status: snapshot.status, lastSuccessAt: snapshot.lastSuccessAt, storms: snapshot.storms.map(s => ({ id: s.id, name: s.name, observation: s.current.time })) }))
  return snapshot
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
