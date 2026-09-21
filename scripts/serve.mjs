import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/lib/typhoon.js', ['lib/typhoon.js', 'text/javascript; charset=utf-8']],
  ['/data/latest.json', ['data/latest.json', 'application/json; charset=utf-8']]
])
const port = Number(process.env.PORT || 8016)
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }
  const pathname = new URL(request.url, 'http://localhost').pathname
  const file = files.get(pathname)
  if (!file) { response.writeHead(404).end('Not found'); return }
  try {
    const body = await readFile(fileURLToPath(new URL(file[0], root)))
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    response.writeHead(500).end('Unable to read site file')
  }
})
server.on('error', error => { console.error(`预览服务启动失败：${error.message}`); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`沿海台风通预览：http://127.0.0.1:${server.address().port}`))

