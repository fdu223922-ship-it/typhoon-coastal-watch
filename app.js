// 所有记录均为虚构演示数据。此文件不请求任何气象接口。
const storms = {
  yunxi: {
    name: '云汐', english: 'YUNXI', code: 'DEMO-01', strength: '台风级', location: '东南近海（示意）', direction: '西北方向', speed: 18, pressure: 975,
    points: [
      { time: '18 日 08:00', type: '模拟历史', lat: 23.5, lon: 126.2, wind: 10, speed: 28, x: 653, y: 367 },
      { time: '18 日 11:00', type: '模拟历史', lat: 24.1, lon: 125.4, wind: 11, speed: 30, x: 598, y: 330 },
      { time: '18 日 14:00', type: '模拟定位', lat: 24.8, lon: 124.6, wind: 12, speed: 35, x: 536, y: 287 },
      { time: '18 日 20:00', type: '模拟预报', lat: 25.8, lon: 123.6, wind: 12, speed: 35, x: 472, y: 237 },
      { time: '19 日 02:00', type: '模拟预报', lat: 26.7, lon: 122.5, wind: 12, speed: 35, x: 408, y: 188 },
      { time: '19 日 14:00', type: '模拟预报', lat: 28.0, lon: 121.2, wind: 11, speed: 30, x: 332, y: 133 }
    ]
  },
  lanchuan: {
    name: '岚川', english: 'LANCHUAN', code: 'DEMO-02', strength: '强热带风暴级', location: '远海海域（示意）', direction: '偏北方向', speed: 12, pressure: 988,
    points: [
      { time: '18 日 08:00', type: '模拟历史', lat: 20.8, lon: 128.1, wind: 8, speed: 20, x: 678, y: 399 },
      { time: '18 日 11:00', type: '模拟历史', lat: 21.3, lon: 128.0, wind: 9, speed: 23, x: 672, y: 360 },
      { time: '18 日 14:00', type: '模拟定位', lat: 21.9, lon: 127.9, wind: 10, speed: 25, x: 661, y: 312 },
      { time: '18 日 20:00', type: '模拟预报', lat: 22.8, lon: 127.8, wind: 10, speed: 25, x: 650, y: 259 },
      { time: '19 日 02:00', type: '模拟预报', lat: 23.7, lon: 127.6, wind: 11, speed: 30, x: 634, y: 208 },
      { time: '19 日 14:00', type: '模拟预报', lat: 25.1, lon: 127.5, wind: 11, speed: 30, x: 619, y: 146 }
    ]
  }
}

// 地区信号是独立预设场景，不由台风强度、位置或距离计算。
const regions = {
  wenzhou: { name: '温州市鹿城区', level: 'orange', title: '台风橙色预警', time: '18 日 13:30', copy: '此处演示较高级别预警的阅读方式：先确认所在地区，再查看发布时次与具体防御要求。', status: '模拟生效' },
  ningde: { name: '宁德市蕉城区', level: 'yellow', title: '台风黄色预警', time: '18 日 13:00', copy: '此处演示黄色预警信息卡。真实情况下，请核对当地气象部门发布的完整预警与防御指引。', status: '模拟生效' },
  xiamen: { name: '厦门市思明区', level: 'blue', title: '台风蓝色预警', time: '18 日 12:30', copy: '此处演示蓝色预警信息卡。预警针对具体地区，不可仅用台风中心风力推断所在地影响。', status: '模拟生效' },
  shantou: { name: '汕头市金平区', level: 'red', title: '台风红色预警', time: '18 日 13:45', copy: '此处演示红色预警的醒目呈现。这不是当地正在发生的天气，也不是实际转移或停课通知。', status: '模拟生效' },
  haikou: { name: '海口市美兰区', level: 'unavailable', title: '地区数据未接入', time: null, copy: '演示“尚未覆盖”的状态。没有数据不代表没有预警或没有风险，请通过当地官方渠道确认。', status: '未接入示例' }
}

const $ = id => document.getElementById(id)
const state = { storm: 'yunxi', selected: 2, zoom: 1 }
const svgNS = 'http://www.w3.org/2000/svg'
const text = (id, value) => { $(id).textContent = value }

function svgElement(tag, attrs, content) {
  const element = document.createElementNS(svgNS, tag)
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
  if (content !== undefined) element.textContent = content
  return element
}

function renderMap() {
  const storm = storms[state.storm]
  const current = storm.points[2]
  const selected = storm.points[state.selected]
  const showForecast = $('show-forecast').checked
  for (const id of ['wind-circles', 'forecast-path', 'history-path', 'map-points', 'current-marker', 'selected-marker']) $(id).replaceChildren()

  if ($('show-wind').checked) {
    for (const radius of [80, 49]) $('wind-circles').append(svgElement('circle', { cx: current.x, cy: current.y, r: radius, fill: 'url(#wind-halo)', stroke: '#399c8d', 'stroke-opacity': .35, 'stroke-width': 1, 'stroke-dasharray': radius === 49 ? '3 4' : 'none' }))
  }
  const line = points => points.map(point => `${point.x},${point.y}`).join(' ')
  $('history-path').append(svgElement('polyline', { points: line(storm.points.slice(0, 3)), fill: 'none', stroke: '#208a7b', 'stroke-width': 3, 'stroke-linecap': 'round' }))
  if (showForecast) $('forecast-path').append(svgElement('polyline', { points: line(storm.points.slice(2)), fill: 'none', stroke: '#b98248', 'stroke-width': 2.5, 'stroke-dasharray': '7 7', 'stroke-linecap': 'round' }))

  storm.points.forEach((point, index) => {
    if (index > 2 && !showForecast) return
    $('map-points').append(svgElement('circle', { cx: point.x, cy: point.y, r: index === 2 ? 6 : 4.5, fill: index <= 2 ? '#fff' : '#fcf4e8', stroke: index <= 2 ? '#208a7b' : '#b98248', 'stroke-width': 2 }))
    if (index === 0 || index === 5) $('map-points').append(svgElement('text', { x: point.x + 11, y: point.y + 5, fill: '#627f79', 'font-size': 10 }, index === 0 ? '18 日 08:00' : '19 日 14:00'))
  })

  const marker = $('current-marker')
  marker.append(svgElement('circle', { cx: current.x, cy: current.y, r: 14, fill: '#fff', stroke: '#198276', 'stroke-width': 2 }))
  marker.append(svgElement('path', { d: `M${current.x + 8} ${current.y - 7}c-13-7-23 10-10 15M${current.x - 8} ${current.y + 7}c13 7 23-10 10-15`, fill: 'none', stroke: '#198276', 'stroke-width': 2 }))
  marker.append(svgElement('circle', { cx: current.x, cy: current.y, r: 3.5, fill: '#198276' }))
  marker.append(svgElement('rect', { x: current.x - 34, y: current.y - 48, width: 68, height: 24, rx: 5, fill: '#176d63' }))
  marker.append(svgElement('text', { x: current.x, y: current.y - 32, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11 }, `${storm.name} · ${current.wind}级`))

  if (state.selected !== 2 && (state.selected <= 2 || showForecast)) $('selected-marker').append(svgElement('circle', { cx: selected.x, cy: selected.y, r: 11, fill: 'none', stroke: '#17383e', 'stroke-width': 2 }))
  text('map-svg-title', `${storm.name}虚构台风路径示意`)
  text('map-storm-label', storm.name)
  text('point-detail', `${selected.time} · ${selected.type} · ${selected.wind} 级`)
  text('point-coordinates', `${selected.lat.toFixed(1)}°N · ${selected.lon.toFixed(1)}°E · 模拟风速 ${selected.speed} 米/秒`)
  $('track-time').setAttribute('aria-valuetext', `${selected.time}，${selected.type}，${selected.wind}级`)
  $('track-table').replaceChildren(...storm.points.map((point, index) => {
    const row = document.createElement('tr')
    row.dataset.selected = String(index === state.selected)
    for (const value of [point.time, point.type, `${point.lat.toFixed(1)}°N / ${point.lon.toFixed(1)}°E`, `${point.wind} 级`]) {
      const cell = document.createElement('td')
      cell.textContent = value
      row.append(cell)
    }
    return row
  }))
}

function renderStorm() {
  const storm = storms[state.storm]
  const current = storm.points[2]
  text('storm-name', storm.name)
  text('storm-code', `${storm.english} · ${storm.code}`)
  text('storm-strength', storm.strength)
  text('storm-location', storm.location)
  text('storm-coordinates', `${current.lat.toFixed(1)}°N / ${current.lon.toFixed(1)}°E`)
  text('storm-direction', storm.direction)
  document.querySelector('.direction-arrow').textContent = state.storm === 'yunxi' ? '↖' : '↑'
  text('storm-speed', storm.speed)
  text('storm-wind', current.wind)
  text('storm-wind-speed', current.speed)
  text('storm-pressure', storm.pressure)
  for (const button of document.querySelectorAll('[data-storm]')) button.setAttribute('aria-pressed', String(button.dataset.storm === state.storm))
  $('track-time').value = state.selected
  renderMap()
}

function renderWarning() {
  const region = regions[$('region-select').value]
  // 内容均来自本文件内的固定演示对象，不接收外部 HTML。
  $('warning-content').innerHTML = `<article class="warning-card" data-level="${region.level}"><div class="warning-top"><strong>△ ${region.level === 'unavailable' ? '数据状态演示' : '模拟预警信号'}</strong><span>${region.status}</span></div><h3>${region.title}</h3><p class="warning-time">${region.time ? `模拟发布：2026 年 8 月 ${region.time} · UTC+8` : '没有可供展示的地区数据'}</p><p class="warning-copy">${region.copy}</p><div class="warning-meta">演示区域：${region.name}<br>数据来源：本项目虚构场景<br>发布机构：无（非官方预警）</div></article>`
}

function setZoom(zoom) {
  state.zoom = Math.min(1.6, Math.max(.8, Math.round(zoom * 10) / 10))
  $('map-scene').setAttribute('transform', `translate(${400 * (1 - state.zoom)} ${225 * (1 - state.zoom)}) scale(${state.zoom})`)
  $('zoom-in').disabled = state.zoom >= 1.6
  $('zoom-out').disabled = state.zoom <= .8
}

for (const button of document.querySelectorAll('[data-storm]')) button.addEventListener('click', () => {
  state.storm = button.dataset.storm
  state.selected = 2
  setZoom(1)
  renderStorm()
})
$('region-select').addEventListener('change', renderWarning)
$('track-time').addEventListener('input', event => { state.selected = Number(event.target.value); renderMap() })
$('show-forecast').addEventListener('change', () => {
  if (!$('show-forecast').checked && state.selected > 2) { state.selected = 2; $('track-time').value = 2 }
  $('track-time').max = $('show-forecast').checked ? 5 : 2
  document.querySelector('.timeline-labels span:last-child').textContent = $('show-forecast').checked ? '19 日 14:00' : '18 日 14:00'
  document.querySelector('.timeline-labels span:nth-child(2)').textContent = $('show-forecast').checked ? '14:00 定位' : '11:00'
  renderMap()
})
$('show-wind').addEventListener('change', renderMap)
$('zoom-in').addEventListener('click', () => setZoom(state.zoom + .2))
$('zoom-out').addEventListener('click', () => setZoom(state.zoom - .2))
$('zoom-reset').addEventListener('click', () => setZoom(1))

const dialog = $('about-dialog')
for (const button of document.querySelectorAll('[data-open-about]')) button.addEventListener('click', () => { if (!dialog.open) dialog.showModal() })
$('close-dialog').addEventListener('click', () => dialog.close())
$('confirm-dialog').addEventListener('click', () => dialog.close())
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close()
})

renderStorm()
renderWarning()
