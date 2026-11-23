// 文档树 · 本地服务
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { extract, kindOf, SUPPORTED_EXT } from './lib/extract.mjs'
import * as store from './lib/store.mjs'
import * as llm from './lib/llm.mjs'
import { buildAskMessages, buildSummaryMessages, treeToMarkdown, execTool } from './lib/context.mjs'
import { renderPageImage } from './lib/render.mjs'
import { pptToPdf } from './lib/office.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version
  } catch {
    return '0.0.0'
  }
})()

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
    return json(res, 200, { docs: await store.listDocs(), groups: await store.listGroups(), flags: await store.getFlags(), config: llm.publicConfig(), serverVersion: SERVER_VERSION })
  }

  if (p === '/api/usage' && req.method === 'GET') {
    const docs = await store.listDocs()
    const groups = await store.listGroups()
    const groupName = new Map(groups.map((g) => [g.id, g.name]))
    const seen = new Set()
    const totals = { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0, rounds: 0 }
    const dayMap = new Map()
    const docMap = new Map()
    const dayKey = (t) => {
      const d = new Date(t)
      const p = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    }
    for (const doc of docs) {
      const key = doc.groupId || doc.id
      if (seen.has(key)) continue
      seen.add(key)
      const tree = await store.getTree(doc.id)
      for (const n of Object.values(tree.nodes || {})) {
        const u = n.usage
        if (!u) continue
        totals.input += u.input || 0
        totals.output += u.output || 0
        totals.cacheHit += u.cacheHit || 0
        totals.cacheMiss += u.cacheMiss || 0
        totals.total += u.total || (u.input || 0) + (u.output || 0)
        totals.requests += 1
        totals.rounds += u.rounds || 1
        const dk = dayKey(n.createdAt || Date.now())
        if (!dayMap.has(dk)) dayMap.set(dk, { date: dk, input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0 })
        const dd = dayMap.get(dk)
        dd.input += u.input || 0
        dd.output += u.output || 0
        dd.cacheHit += u.cacheHit || 0
        dd.cacheMiss += u.cacheMiss || 0
        dd.total += u.total || (u.input || 0) + (u.output || 0)
        dd.requests += 1
        if (!docMap.has(key))
          docMap.set(key, {
            title: doc.groupId ? groupName.get(doc.groupId) || doc.title : doc.title,
            total: 0,
            cacheHit: 0,
            cacheMiss: 0,
            requests: 0
          })
        const dm = docMap.get(key)
        dm.total += u.total || (u.input || 0) + (u.output || 0)
        dm.cacheHit += u.cacheHit || 0
        dm.cacheMiss += u.cacheMiss || 0
        dm.requests += 1
      }
    }
    const hitRate = totals.cacheHit + totals.cacheMiss > 0 ? totals.cacheHit / (totals.cacheHit + totals.cacheMiss) : 0
    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
    const perDoc = [...docMap.values()].sort((a, b) => b.total - a.total).slice(0, 8)
    return json(res, 200, { totals: { ...totals, hitRate }, days, docs: perDoc })
  }

  if (p === '/api/config' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const patch = {}
    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl', 'apiFormat', 'visionFormat']) {
      if (typeof body[k] === 'string' && body[k].trim()) patch[k] = body[k].trim()
    }
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()
    if (typeof body.visionApiKey === 'string' && body.visionApiKey.trim()) patch.visionApiKey = body.visionApiKey.trim()
    if (body.visionApiKey === '') patch.visionApiKey = ''
    if (body.visionBaseUrl === '') patch.visionBaseUrl = ''
    if (['low', 'high', 'max'].includes(body.effort)) patch.effort = body.effort
    llm.writeConfig(patch)
    return json(res, 200, { config: llm.publicConfig() })
  }

  if (p === '/api/import' && req.method === 'POST') {
    const name = decodeURIComponent(req.headers['x-filename'] || 'document')
    const ext = path.extname(name).toLowerCase()
    if (!SUPPORTED_EXT.has(ext)) {
      return json(res, 415, { error: `暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX` })
    }
    const buf = await readBody(req)
    const hash = crypto.createHash('sha256').update(buf).digest('hex')

    // 同一份文件再次导入（可能之前被移出列表）→ 复用原文档，提问树与上下文都还在
    let revived = null
    for (const meta of await store.listDocs()) {
      const old = await store.getDoc(meta.id)
      if (!old) continue
      // 老数据没有 hash：按实际文件补算一次，保证同一文件能被认出来
      if (!old.hash) {
        try {
          const fb = await fsp.readFile(store.filePath(old.id, old.ext))
          old.hash = crypto.createHash('sha256').update(fb).digest('hex')
          await store.saveDoc(old)
        } catch {}
      }
      if (old.hash !== hash) continue
      old.hidden = false
      old.updatedAt = Date.now()
      old.filename = name
      await store.saveDoc(old)
      revived = old
      break
    }
    if (revived) {
      return json(res, 200, { doc: { id: revived.id, title: revived.title, kind: revived.kind, pages: revived.pages.length }, revived: true })
    }

    let sourceBuf = buf
    let sourceExt = ext
    if (ext === '.ppt' || ext === '.pptx') {
      try {
        sourceBuf = await pptToPdf(buf, ext)
        sourceExt = '.pdf'
      } catch (e) {
        if (ext === '.ppt') {
          return json(res, 415, { error: '这个 .ppt 转换失败：' + String(e.message || e).slice(0, 160) + '。可以先用 PowerPoint 另存为 PDF 再导入。' })
        }
        // pptx 转换失败时退回纯文字提取
      }
    }
    const { kind, pages } = await extract(sourceBuf, sourceExt)
    const id = crypto.randomBytes(6).toString('hex')
    await store.saveFile(id, sourceExt, sourceBuf)
    const doc = {
      id,
      title: path.basename(name, path.extname(name)) || '未命名文档',
      filename: name,
      kind,
      ext: sourceExt,
      pages,
      summary: '',
      hash,
      hidden: false,
      bytes: sourceBuf.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
      // 软删除：只从列表移除，保留文件与提问树
      await store.setHidden(m[1], true)
      return json(res, 200, { ok: true, hidden: true })
    }
  }

if (p === '/api/flags' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const patch = {}
    for (const k of ['welcomeSeen', 'guideSeen']) if (typeof body[k] === 'boolean') patch[k] = body[k]
    const flags = await store.setFlags(patch)
    return json(res, 200, { flags })
  }

  if (p === '/api/group' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    const ids = Array.isArray(body.docIds) ? body.docIds.filter(Boolean).slice(0, 50) : []
    if (ids.length < 2) return json(res, 400, { error: '至少选择两份文档' })
    const g = await store.createGroup(String(body.name || '').trim(), ids)
    return json(res, 200, { group: g })
  }

  if (p === '/api/group/update' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    const g = await store.updateGroup(body.id, {
      name: body.name,
      add: Array.isArray(body.add) ? body.add : [],
      remove: Array.isArray(body.remove) ? body.remove : []
    })
    return json(res, 200, { group: g, dissolved: !g })
  }

  if (p === '/api/group/dissolve' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    await store.dissolveGroup(body.id)
    return json(res, 200, { ok: true })
  }

  if (p === '/api/doc/restore' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    await store.setHidden(body.id, false)
    return json(res, 200, { ok: true })
  }

  if (p === '/api/doc/purge' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    await store.deleteDoc(body.id)
    return json(res, 200, { ok: true })
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

  if (p === '/api/instruction/remove' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const doc = await store.getDoc(body.docId)
    if (!doc) return json(res, 404, { error: '文档不存在' })
    if (body.clear) doc.instructions = []
    else {
      const list = Array.isArray(doc.instructions) ? doc.instructions : []
      const i = Number(body.index)
      if (Number.isInteger(i) && i >= 0 && i < list.length) list.splice(i, 1)
      doc.instructions = list
    }
    await store.saveDoc(doc)
    return json(res, 200, { ok: true, count: doc.instructions.length, instructions: doc.instructions })
  }

  if (p === '/api/instruction' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const doc = await store.getDoc(body.docId)
    if (!doc) return json(res, 404, { error: '文档不存在' })
    const text = String(body.text || '').trim().slice(0, 500)
    if (!text) return json(res, 400, { error: '指令不能为空' })
    if (/^(清除|清空).*指令$/.test(text)) {
      doc.instructions = []
      await store.saveDoc(doc)
      return json(res, 200, { ok: true, count: 0, reply: '已清除所有指令' })
    }
    const cfg = llm.readConfig()
    if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })
    let reply = ''
    try {
      const s = await llm.chat(
        [
          { role: 'system', content: '你是「文档树」的指令接收器。用户会给出关于后续回答方式的指令。只回复一句简短确认（不超过 20 字），不要解释、不要重复指令。' },
          { role: 'user', content: text }
        ],
        { maxTokens: 60, effort: 'low' }
      )
      reply = String(s || '').trim().slice(0, 60)
    } catch {}
    doc.instructions = [...(doc.instructions || []), text].slice(-20)
    await store.saveDoc(doc)
    return json(res, 200, { ok: true, count: doc.instructions.length, reply })
  }

  if (p === '/api/ask/resume' && req.method === 'POST') return handleResume(req, res)

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

async function handleResume(req, res) {
  const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
  const cfg = llm.readConfig()
  if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })

  const doc = await store.getDoc(body.docId)
  if (!doc) return json(res, 404, { error: '文档不存在' })
  const group = await store.groupOfDoc(doc.id)
  let docs = [doc]
  if (group) docs = (await Promise.all(group.docIds.map((id) => store.getDoc(id)))).filter(Boolean)

  const tree = await store.getTree(doc.id)
  const node = tree.nodes[body.nodeId]
  if (!node) return json(res, 404, { error: '这条回答不存在' })

  let resumeImage = null
  if (doc.kind === 'pdf') {
    try {
      resumeImage = await renderPageImage(doc, node.anchor?.page || 1)
    } catch {}
  }
  const messages = buildAskMessages({ doc, docs, tree, node, image: resumeImage })
  messages.push({ role: 'assistant', content: node.answer || '（还没有任何内容）' })
  messages.push({
    role: 'user',
    content: '（上面的回答被中断了。请从断点处继续写，不要重复已有内容，也不要重新开头；必要时调用工具补读原文。）'
  })

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  })
  const sse = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`)
  sse({ type: 'meta', node })

  const ac = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    try {
      ac.abort()
    } catch {}
  }, 120000)
  req.on('close', () => ac.abort())
  res.on('close', () => ac.abort())

  try {
    const usage = await llm.streamChatWithTools(
      messages,
      (d) => {
        node.answer += d
        sse({ type: 'delta', text: d })
      },
      {
        signal: ac.signal,
        model: resumeImage ? cfg.visionModel || node.model || cfg.model : node.model || cfg.model,
        provider: resumeImage
          ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }
          : null,
        exec: (name, args) => execWithPageImages(docs, doc.id, name, args),
        onTool: (t) => sse({ type: 'tool', name: t.name, args: t.args }),
        onReasoning: (t) => {
          node.reasoning = (node.reasoning || '') + t
          sse({ type: 'reasoning', text: t })
        }
      }
    )
    if (usage) {
      const prev = node.usage || {}
      node.usage = {
        input: (prev.input || 0) + usage.input,
        output: (prev.output || 0) + usage.output,
        cacheHit: (prev.cacheHit || 0) + usage.cacheHit,
        cacheMiss: (prev.cacheMiss || 0) + usage.cacheMiss,
        total: (prev.total || 0) + usage.total,
        rounds: (prev.rounds || 0) + (usage.rounds || 1)
      }
      sse({ type: 'usage', usage: node.usage })
    }
    delete node.stopped
  } catch (e) {
    if (timedOut) {
      node.error = '请求超时（120 秒），已中止'
      sse({ type: 'error', message: node.error })
    } else if (ac.signal.aborted || (e && e.name === 'AbortError')) {
      node.stopped = true
      sse({ type: 'stopped' })
    } else {
      node.error = String(e.message || e)
      sse({ type: 'error', message: node.error })
    }
  }

  clearTimeout(timeout)
  delete node.status
  await store.saveTree(doc.id, tree)
  sse({ type: 'done', node })
  res.end()
}

async function execWithPageImages(docs, docId, name, args) {
  const out = await execTool(docs, docId, name, args)
  if (name === 'read_page' && args && args.page) {
    let target = docs.find((d) => d.id === docId) || docs[0]
    if (args.doc) {
      const q = String(args.doc).toLowerCase()
      target = docs.find((d) => (d.title || '').toLowerCase().includes(q)) || target
    }
    if (target && target.kind === 'pdf') {
      const img = await renderPageImage(target, Number(args.page)).catch(() => null)
      if (img) return { text: out, image: img }
    }
  }
  return out
}

async function handleAsk(req, res) {
  const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
  const cfg = llm.readConfig()
  if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })

  const doc = await store.getDoc(body.docId)
  if (!doc) return json(res, 404, { error: '文档不存在' })
  const group = await store.groupOfDoc(doc.id)
  let docs = [doc]
  if (group) {
    docs = (await Promise.all(group.docIds.map((id) => store.getDoc(id)))).filter(Boolean)
  }

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
  let pageImage = body.image || null
  if (!pageImage && doc.kind === 'pdf') {
    try {
      pageImage = await renderPageImage(doc, body.anchor?.page || 1)
    } catch (e) {
      console.warn('[render]', e && e.message)
    }
  }
  const hasImage = Boolean(pageImage)
  const useModel = hasImage ? cfg.visionModel || cfg.model : cfg.model
  const provider = hasImage
    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }
    : null
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
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    try {
      ac.abort()
    } catch {}
  }, 120000)
  req.on('close', () => ac.abort())
  res.on('close', () => ac.abort())

  try {
    const messages = buildAskMessages({ docs, tree, node, image: pageImage })
    const usage = await llm.streamChatWithTools(
      messages,
      (d) => {
        node.answer += d
        sse({ type: 'delta', text: d })
      },
      {
        signal: ac.signal,
        model: useModel,
        provider,
        exec: (name, args) => execWithPageImages(docs, doc.id, name, args),
        onTool: (t) => sse({ type: 'tool', name: t.name, args: t.args }),
        onReasoning: (t) => {
          node.reasoning = (node.reasoning || '') + t
          sse({ type: 'reasoning', text: t })
        }
      }
    )
    if (usage) {
      node.usage = usage
      sse({ type: 'usage', usage })
    }
    node.status = 'done'
    delete node.stopped
  } catch (e) {
    if (timedOut) {
      node.status = 'error'
      node.error = '请求超时（120 秒），已中止'
      sse({ type: 'error', message: node.error })
    } else if (ac.signal.aborted || (e && e.name === 'AbortError')) {
      node.status = 'stopped'
      node.stopped = true
      sse({ type: 'stopped' })
    } else {
      node.status = 'error'
      node.error = String(e.message || e)
      sse({ type: 'error', message: node.error })
    }
  }

  clearTimeout(timeout)
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
