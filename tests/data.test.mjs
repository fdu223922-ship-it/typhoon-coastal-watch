import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceTime, numberOrNull, parseList, normalizeStorm, failedSnapshot, freshness, validateSnapshot, SOURCE } from '../lib/typhoon.js'
import { collect, fetchJSON } from '../scripts/fetch-data.mjs'

// 原创测试样本，只用于自动测试，构建不会发布 tests/。
const now = new Date('2026-09-21T10:00:00Z')
const item = { id: '202601', name: '测试样本', english: 'TEST', active: true }
const point = { time: '2026-09-21 17:00:00', lat: 24.5, lng: 125.5, power: 12, speed: 33, pressure: 970, move_speed: 18, move_dir: '西北', strong: '台风', radius7_quad: { ne: 300, se: 200, sw: 100, nw: 250 } }
const detail = [{ tfbh: item.id, name: item.name, points: [point] }]

test('上海来源时间显式使用 UTC+8，非法日期和模糊格式拒绝', () => {
  assert.equal(sourceTime(point.time), '2026-09-21T17:00:00+08:00')
  assert.throws(() => sourceTime('2026-02-30 17:00:00'))
  assert.throws(() => sourceTime('09/21/2026'))
})
test('缺测不是零，真实的零不丢失', () => {
  for (const value of [null, undefined, '', ' ', '--', -999, true]) assert.equal(numberOrNull(value), null)
  assert.equal(numberOrNull(0), 0)
})
test('空数组可以表示无活动台风，错误对象与无活动标记不可', () => {
  assert.deepEqual(parseList([]), [])
  assert.throws(() => parseList({ message: 'error' }))
  assert.throws(() => parseList([{ tfbh: item.id }]))
})
test('保留风速与移速，按机构区分预报，不使用旧时次预报', () => {
  const raw = structuredClone(detail)
  raw[0].points[0].forecast = [{ sets: '中国', points: [{ ...point, time: '2026-09-22 05:00:00', speed: 30 }] }, { sets: '日本', points: [{ ...point, time: '2026-09-22 08:00:00', speed: 40 }] }]
  const storm = normalizeStorm(item, raw, now)
  assert.equal(storm.current.windSpeed, 33)
  assert.equal(storm.current.moveSpeed, 18)
  assert.deepEqual(storm.forecasts.map(f => f.agency), ['中国', '日本'])
  assert.equal(storm.forecasts[0].issuedAt, null)
  raw[0].points.push({ ...point, time: '2026-09-21 18:00:00' })
  assert.deepEqual(normalizeStorm(item, raw, now).forecasts, [])
})
test('错误坐标、重复时次、编号错配、未来实况拒绝', () => {
  assert.throws(() => normalizeStorm(item, [{ tfbh: '202602', points: [point] }], now))
  assert.throws(() => normalizeStorm(item, [{ tfbh: item.id, points: [{ ...point, lat: 200 }] }], now))
  assert.throws(() => normalizeStorm(item, [{ tfbh: item.id, points: [point, point] }], now))
  assert.throws(() => normalizeStorm(item, detail, new Date('2026-09-20T00:00:00Z')))
})
test('跨年活动风暴纳入，已结束台风不抓详情', async () => {
  const calls = []
  const snapshot = await collect({ now, get: async url => {
    calls.push(url)
    if (url.includes('year=2026')) return [{ tfbh: item.id, name: item.name, is_current: 0 }]
    if (url.includes('year=2025')) return [{ tfbh: '202599', name: '跨年测试', is_current: 1 }]
    return [{ tfbh: '202599', points: [point] }]
  } })
  assert.equal(snapshot.storms[0].id, '202599')
  assert.equal(calls.filter(url => url.includes('getTfDetail')).length, 1)
})
test('任何详情失败使整次采集失败，不能静默少报台风', async () => {
  await assert.rejects(collect({ now, get: async url => url.includes('getTfByYear') ? [{ tfbh: item.id, name: item.name, is_current: 1 }] : [] }))
})
test('采集失败保留原业务时间与成功时间，不伪造无台风', () => {
  const old = { lastSuccessAt: '2026-09-21T09:10:00Z', storms: [normalizeStorm(item, detail, now)] }
  const result = failedSnapshot(old, now, 'HTTP 503')
  assert.equal(result.lastSuccessAt, old.lastSuccessAt)
  assert.equal(result.storms[0].current.time, '2026-09-21T17:00:00+08:00')
  assert.equal(freshness(result, now.getTime()).state, 'error')
  assert.equal(freshness(failedSnapshot(null, now, 'error')).state, 'unavailable')
})
test('即使部署未继续运行，浏览器也按当前时间识别过期快照', () => {
  assert.equal(freshness({ status: 'ok', lastSuccessAt: '2026-09-21T09:00:00Z' }, now.getTime()).state, 'stale')
})
test('模拟数据或陌生来源不能被当作真实快照', () => {
  assert.throws(() => validateSnapshot({ schemaVersion: 1, mode: 'demo', source: SOURCE }))
})
test('HTTP 失败和非 JSON 响应必须抛错', async () => {
  await assert.rejects(fetchJSON('https://example.test', { retries: 0, fetcher: async () => ({ ok: false, status: 503 }) }))
  await assert.rejects(fetchJSON('https://example.test', { retries: 0, fetcher: async () => ({ ok: true, text: async () => '<html>Error</html>' }) }))
})
