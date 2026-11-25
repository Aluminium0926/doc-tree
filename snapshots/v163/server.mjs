// 文档树 · 本地 HTTP 服务（入口）
// v153 起这里只做三件事：静态资源、路由分发、统一错误处理；业务在 lib/routes + lib/services。
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as store from './lib/store.mjs'
import { createRouter } from './lib/http/router.mjs'
import { json } from './lib/http/respond.mjs'
import { BadRequest } from './lib/ids.mjs'
import { state, usage, setFlags, setConfig, setServerVersion } from './lib/routes/state.mjs'
import { importDoc, getDoc, hideDoc, restoreDoc, purgeDoc, getFile, exportDoc } from './lib/routes/docs.mjs'
import { createGroup, updateGroup, dissolveGroup } from './lib/routes/groups.mjs'
import { ask, resume, setInstruction, removeInstruction, setHighlights, deleteNode } from './lib/routes/ask.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, 'public')
const PORT = Number(process.env.PORT || 4317)
const HOST = process.env.HOST || '127.0.0.1'
const SERVER_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version
  } catch {
    return '0.0.0'
  }
})()
setServerVersion(SERVER_VERSION)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.bcmap': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
}
const NO_CACHE = new Set(['.html', '.js', '.mjs', '.css', '.json'])

async function serveStatic(req, res, pathname) {
  let rel
  try {
    rel = decodeURIComponent(pathname)
  } catch {
    throw new BadRequest('路径编码异常')
  }
  if (rel === '/' || rel === '') rel = '/index.html'
  const file = path.resolve(PUBLIC, '.' + rel)
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: 'forbidden' })
  let stat
  try {
    stat = await fsp.stat(file)
  } catch {
    return json(res, 404, { error: 'not found' })
  }
  if (stat.isDirectory()) return json(res, 404, { error: 'not found' })
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': NO_CACHE.has(ext) ? 'no-cache' : 'public, max-age=86400',
    'x-content-type-options': 'nosniff'
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

const router = createRouter()
router
  .get('/api/state', state)
  .get('/api/usage', usage)
  .post('/api/config', setConfig)
  .post('/api/flags', setFlags)
  .post('/api/import', importDoc)
  .get('/api/doc/:id', getDoc)
  .del('/api/doc/:id', hideDoc)
  .get('/api/file/:id', getFile)
  .get('/api/export/:id', exportDoc)
  .post('/api/doc/restore', restoreDoc)
  .post('/api/doc/purge', purgeDoc)
  .post('/api/highlights', setHighlights)
  .post('/api/instruction', setInstruction)
  .post('/api/instruction/remove', removeInstruction)
  .post('/api/group', createGroup)
  .post('/api/group/update', updateGroup)
  .post('/api/group/dissolve', dissolveGroup)
  .post('/api/node/delete', deleteNode)
  .post('/api/ask', ask)
  .post('/api/ask/resume', resume)

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api/')) {
      const method = req.method === 'HEAD' ? 'GET' : req.method
      const hit = router.match(method, url.pathname)
      if (!hit) return json(res, 404, { error: 'not found' })
      if (hit.methodNotAllowed) return json(res, 405, { error: 'method not allowed' })
      const ctx = { req, res, url, params: hit.params, body: null }
      return await hit.handler(ctx)
    }
    return await serveStatic(req, res, url.pathname)
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : 500
    if (status >= 500) console.error(`[${req.method} ${req.url}]`, e?.stack || e)
    if (res.headersSent) {
      try {
        res.end()
      } catch {}
      return
    }
    return json(res, status, { error: String(e?.message || e) })
  }
})

server.keepAliveTimeout = 65_000
server.headersTimeout = 70_000

await store.ensureDirs()
server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? '0.0.0.0（局域网可访问）' : HOST
  console.log(`文档树已启动 → http://${shown}:${PORT}  (v${SERVER_VERSION})`)
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.warn('[warn] 正在监听非本机地址：任何能访问该端口的人都能读写本地文档，请只在可信网络使用')
  }
})
