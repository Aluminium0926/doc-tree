// 移动端开发服务器：静态资源 + /proxy/llm 转发（模拟 Android 里的本地代理）
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const WWW = path.join(here, 'www')
const PORT = Number(process.env.PORT || 4500)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.bcmap': 'application/octet-stream',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm'
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/proxy/llm' && req.method === 'POST') {
      const target = req.headers['x-target']
      if (!target) {
        res.writeHead(400, { 'content-type': 'application/json' })
        return res.end('{"error":"missing x-target"}')
      }
      const body = await readBody(req)
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          authorization: req.headers.authorization || '',
          'content-type': 'application/json'
        },
        body
      })
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache'
      })
      if (upstream.body) {
        const reader = upstream.body.getReader()
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      }
      return res.end()
    }

    let p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/' || p === '') p = '/index.html'
    const file = path.join(WWW, p)
    if (!file.startsWith(WWW)) {
      res.writeHead(403)
      return res.end()
    }
    const stat = fs.statSync(file)
    if (stat.isDirectory()) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache'
    })
    fs.createReadStream(file).pipe(res)
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('error: ' + e.message)
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`mobile dev server -> http://127.0.0.1:${PORT}`))
