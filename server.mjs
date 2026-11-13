// 文档树 · 本地服务
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { extract, kindOf } from './lib/extract.mjs'
import * as store from './lib/store.mjs'
import * as llm from './lib/llm.mjs'
import { buildAskMessages, buildSummaryMessages, treeToMarkdown } from './lib/context.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, 'public')
const PORT = Number(process.env.PORT || 4317)
const summaryTried = new Set()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.pdf': 'application/pdf',
  '.bcmap': 'application/octet-stream',
  '.ttf': 'font/ttf'
}

function json(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

function readBody(req, limit = 300 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('文件过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const file = path.join(PUBLIC, rel)
  if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'forbidden' })
  try {
    const stat = await fsp.stat(file)
    if (stat.isDirectory()) return json(res, 404, { error: 'not found' })
    const ext = path.extname(file).toLowerCase()
    const noCache = ['.html', '.css', '.js', '.mjs', '.json'].includes(ext)
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': noCache ? 'no-cache' : 'public, max-age=86400'
    })
    fs.createReadStream(file).pipe(res)
  } catch {
    json(res, 404, { error: 'not found' })
  }
}

async function handleApi(req, res, url) {
  const p = url.pathname

  if (p === '/api/state' && req.method === 'GET') {
    return json(res, 200, { docs: await store.listDocs(), config: llm.publicConfig() })
  }

  if (p === '/api/config' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const patch = {}
    for (const k of ['baseUrl', 'model', 'visionModel']) {
      if (typeof body[k] === 'string' && body[k].trim()) patch[k] = body[k].trim()
    }
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()
    if (['low', 'high', 'max'].includes(body.effort)) patch.effort = body.effort
    llm.writeConfig(patch)
    return json(res, 200, { config: llm.publicConfig() })
  }

  if (p === '/api/import' && req.method === 'POST') {
    const name = decodeURIComponent(req.headers['x-filename'] || 'document')
    const buf = await readBody(req)
    const ext = path.extname(name).toLowerCase()
    const { kind, pages } = await extract(buf, ext)
    const id = crypto.randomBytes(6).toString('hex')
    await store.saveFile(id, ext, buf)
    const doc = {
      id,
      title: path.basename(name, path.extname(name)) || '未命名文档',
      filename: name,
      kind,
      ext,
      pages,
      summary: '',
      bytes: buf.length,
      createdAt: Date.now()
    }
    await store.saveDoc(doc)

    // 后台生成摘要，不阻塞响应
    ;(async () => {
      try {
        const s = await llm.chat(buildSummaryMessages(doc), { maxTokens: 700, effort: 'low' })
        doc.summary = s.trim()
        await store.saveDoc(doc)
        console.log('[summary] ok', id)
      } catch (e) {
        console.warn('[summary] failed:', e.message)
      }
    })()

    return json(res, 200, {
      doc: { id: doc.id, title: doc.title, kind: doc.kind, pages: pages.length }
    })
  }

  {
    const m = p.match(/^\/api\/doc\/([0-9a-f]+)$/)
    if (m && req.method === 'GET') {
      const doc = await store.getDoc(m[1])
      if (!doc) return json(res, 404, { error: '文档不存在' })
      const tree = await store.getTree(m[1])
      return json(res, 200, { doc, tree })
    }
    if (m && req.method === 'DELETE') {
      await store.deleteDoc(m[1])
      return json(res, 200, { ok: true })
    }
  }

  {
    const m = p.match(/^\/api\/file\/([0-9a-f]+)$/)
    if (m && req.method === 'GET') {
      const doc = await store.getDoc(m[1])
      if (!doc) return json(res, 404, { error: '文档不存在' })
      const file = store.filePath(doc.id, doc.ext)
      const stat = await fsp.stat(file)
      res.writeHead(200, {
        'content-type': doc.ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',
        'content-length': stat.size,
        'accept-ranges': 'bytes'
      })
      return fs.createReadStream(file).pipe(res)
    }
  }

  if (p === '/api/ask' && req.method === 'POST') {
    return handleAsk(req, res)
  }

  if (p === '/api/highlights' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const doc = await store.getDoc(body.docId)
    if (!doc) return json(res, 404, { error: '文档不存在' })
    doc.highlights = Array.isArray(body.highlights) ? body.highlights.slice(0, 3000) : []
    await store.saveDoc(doc)
    return json(res, 200, { ok: true, count: doc.highlights.length })
  }

  {
    const m = p.match(/^\/api\/export\/([0-9a-f]+)$/)
    if (m && req.method === 'GET') {
      const doc = await store.getDoc(m[1])
      if (!doc) return json(res, 404, { error: '文档不存在' })
      const tree = await store.getTree(m[1])
      const md = treeToMarkdown(doc, tree)
      res.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.title + '-追问树.md')}`
      })
      return res.end(md)
    }
  }

  if (p === '/api/node/delete' && req.method === 'POST') {
    const { docId, nodeId } = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const tree = await store.getTree(docId)
    const kill = new Set([nodeId])
    let grew = true
    while (grew) {
      grew = false
      for (const n of Object.values(tree.nodes)) {
        if (n.parentId && kill.has(n.parentId) && !kill.has(n.id)) {
          kill.add(n.id)
          grew = true
        }
      }
    }
    for (const id of kill) delete tree.nodes[id]
    await store.saveTree(docId, tree)
    return json(res, 200, { removed: [...kill] })
  }

  json(res, 404, { error: 'not found' })
}

async function handleAsk(req, res) {
  const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
  const cfg = llm.readConfig()
  if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })

  const doc = await store.getDoc(body.docId)
  if (!doc) return json(res, 404, { error: '文档不存在' })

  // 摘要缺失时自愈（例如导入时服务被重启打断）
  if (!doc.summary && !summaryTried.has(doc.id)) {
    summaryTried.add(doc.id)
    ;(async () => {
      try {
        const s = await llm.chat(buildSummaryMessages(doc), { maxTokens: 700, effort: 'low' })
        if (s.trim()) {
          doc.summary = s.trim()
          await store.saveDoc(doc)
        }
      } catch {}
    })()
  }

  const tree = await store.getTree(body.docId)
  const id = crypto.randomBytes(6).toString('hex')
  const useModel = body.image && cfg.visionModel ? cfg.visionModel : cfg.model
  const node = {
    id,
    docId: body.docId,
    parentId: body.parentId || null,
    anchor: body.anchor || { kind: 'doc', page: 1, quote: '' },
    question: String(body.question || '请讲解这段内容').slice(0, 2000),
    answer: '',
    model: useModel,
    status: 'streaming',
    createdAt: Date.now()
  }
  tree.nodes[id] = node
  await store.saveTree(body.docId, tree)

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  })
  const sse = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`)
  sse({ type: 'meta', node })

  const ac = new AbortController()
  req.on('close', () => ac.abort())

  try {
    const messages = buildAskMessages({ doc, tree, node, image: body.image })
    await llm.streamChat(
      messages,
      (d) => {
        node.answer += d
        sse({ type: 'delta', text: d })
      },
      {
        signal: ac.signal,
        model: useModel,
        onReasoning: (t) => {
          node.reasoning = (node.reasoning || '') + t
          sse({ type: 'reasoning', text: t })
        }
      }
    )
    node.status = 'done'
  } catch (e) {
    node.status = 'error'
    node.error = String(e.message || e)
    sse({ type: 'error', message: node.error })
  }

  if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)
  delete node.status
  await store.saveTree(body.docId, tree)
  sse({ type: 'done', node })
  res.end()
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url)
    return await serveStatic(res, url.pathname)
  } catch (e) {
    console.error('[error]', e)
    if (!res.headersSent) json(res, 500, { error: String(e.message || e) })
    else res.end()
  }
})

await store.ensureDirs()
const HOST = process.env.HOST || '127.0.0.1'
server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? '0.0.0.0（局域网可访问）' : HOST
  console.log(`文档树已启动 → http://${shown}:${PORT}`)
})
