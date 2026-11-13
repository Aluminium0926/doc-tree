// 纯静态托管：只发 www 里的文件，不带 /proxy/llm（用来验证“直连模型”模式）
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const WWW = path.join(here, 'www')
const PORT = Number(process.env.PORT || 4501)
const HOST = process.env.HOST || '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.bcmap': 'application/octet-stream',
  '.wasm': 'application/wasm'
}

http
  .createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0])
    if (p === '/') p = '/index.html'
    const file = path.join(WWW, p)
    if (!file.startsWith(WWW) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('not found')
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    })
    fs.createReadStream(file).pipe(res)
  })
  .listen(PORT, HOST, () => {
    const urls = []
    if (HOST === '0.0.0.0') {
      const nets = os.networkInterfaces()
      for (const list of Object.values(nets)) {
        for (const n of list || []) {
          if (n.family === 'IPv4' && !n.internal) urls.push(`http://${n.address}:${PORT}`)
        }
      }
      console.log(`static server (LAN) -> 本机 http://127.0.0.1:${PORT}`)
      for (const u of urls) console.log('                     手机访问 ' + u)
    } else {
      console.log(`static server -> http://127.0.0.1:${PORT}`)
    }
  })
