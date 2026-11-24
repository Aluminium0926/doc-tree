import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT || 4503)
const WASM = path.join(root, 'node_modules', '@matbee', 'libreoffice-converter', 'wasm')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.cjs': 'text/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent((req.url || '/').split('?')[0])
    if (url === '/') url = '/ppt-lab/index.html'
    if (url.endsWith('/')) url += 'index.html'
    let file
    if (url.startsWith('/wasm/')) {
      file = path.join(WASM, url.slice('/wasm/'.length))
    } else {
      file = path.join(root, url)
    }
    if (!file.startsWith(root) && !file.startsWith(WASM)) {
      res.writeHead(403)
      return res.end('forbidden')
    }
    const st = await fs.promises.stat(file).catch(() => null)
    if (!st || !st.isFile()) {
      res.writeHead(404)
      return res.end('not found')
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-cache',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'cross-origin'
    })
    fs.createReadStream(file).pipe(res)
  } catch (e) {
    res.writeHead(500)
    res.end(String(e?.message || e))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PPT lab: http://127.0.0.1:${PORT}/ppt-lab/`)
})
