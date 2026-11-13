// 本地 API：把前端的 /api/* 请求映射到 IndexedDB + 浏览器内解析 + 模型代理
import * as db from './db.js'
import { extract } from './extract.js'
import { publicConfig, readConfig, writeConfig } from './config.js'
import { chat, streamChat } from './llm.js'
import { buildAskMessages, buildSummaryMessages, treeToMarkdown } from './context.mjs'

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' }
  })

function hex(n = 6) {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

function headerOf(init, name) {
  const h = init?.headers
  if (!h) return ''
  if (typeof h.get === 'function') return h.get(name) || ''
  for (const k of Object.keys(h)) if (k.toLowerCase() === name.toLowerCase()) return h[k]
  return ''
}

async function bodyBytes(init) {
  const b = init?.body
  if (!b) return new ArrayBuffer(0)
  if (b instanceof ArrayBuffer) return b
  if (b instanceof Blob) return await b.arrayBuffer()
  if (typeof b === 'string') return new TextEncoder().encode(b).buffer
  if (b instanceof Uint8Array) return b.buffer
  return new ArrayBuffer(0)
}

async function bodyJson(init) {
  const b = init?.body
  if (!b) return {}
  if (typeof b === 'string') return JSON.parse(b)
  return JSON.parse(new TextDecoder().decode(await bodyBytes(init)))
}

const fileUrls = new Map()

export async function fileUrl(id) {
  if (fileUrls.has(id)) return fileUrls.get(id)
  const f = await db.getFile(id)
  if (!f) throw new Error('文件不存在')
  const url = URL.createObjectURL(f.blob)
  fileUrls.set(id, url)
  return url
}

async function makeSummary(doc) {
  try {
    const s = await chat(buildSummaryMessages(doc), { maxTokens: 700, effort: 'low' })
    if (s.trim()) {
      doc.summary = s.trim()
      await db.saveDoc(doc)
    }
  } catch (e) {
    console.warn('[summary] failed:', e.message)
  }
}

function sseResponse(run) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        await run(send)
      } catch (e) {
        send({ type: 'error', message: String(e?.message || e) })
      } finally {
        controller.close()
      }
    }
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' }
  })
}

async function handleAsk(init) {
  const body = await bodyJson(init)
  const doc = await db.getDoc(body.docId)
  if (!doc) return json({ error: '文档不存在' }, 404)

  if (!doc.summary) makeSummary(doc)

  const tree = await db.getTree(body.docId)
  const cfg = readConfig()
  const id = hex(6)
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
  await db.saveTree(body.docId, tree)

  return sseResponse(async (send) => {
    send({ type: 'meta', node })
    try {
      const messages = buildAskMessages({ doc, tree, node, image: body.image })
      await streamChat(
        messages,
        (d) => {
          node.answer += d
          send({ type: 'delta', text: d })
        },
        {
          model: useModel,
          onReasoning: (t) => {
            node.reasoning = (node.reasoning || '') + t
            send({ type: 'reasoning', text: t })
          }
        }
      )
    } catch (e) {
      node.error = String(e.message || e)
      send({ type: 'error', message: node.error })
    }
    if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)
    delete node.status
    await db.saveTree(body.docId, tree)
    send({ type: 'done', node })
  })
}

async function handleApi(path, init) {
  const method = (init?.method || 'GET').toUpperCase()
  const p = new URL(path, location.href).pathname

  if (p === '/api/state' && method === 'GET') {
    return json({ docs: await db.listDocs(), config: publicConfig() })
  }

  if (p === '/api/config' && method === 'POST') {
    const body = await bodyJson(init)
    const patch = {}
    for (const k of ['baseUrl', 'model', 'visionModel']) {
      if (typeof body[k] === 'string' && body[k].trim()) patch[k] = body[k].trim()
    }
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()
    if (['low', 'high', 'max'].includes(body.effort)) patch.effort = body.effort
    writeConfig(patch)
    return json({ config: publicConfig() })
  }

  if (p === '/api/import' && method === 'POST') {
    const name = decodeURIComponent(headerOf(init, 'x-filename') || 'document')
    const buf = await bodyBytes(init)
    const ext = (name.match(/\.[^.]+$/) || [''])[0].toLowerCase()
    // pdf.js 会把传入的 ArrayBuffer transfer 掉，先固化成 Blob 再解析
    const blob = new Blob([buf])
    const { kind, pages } = await extract(buf.slice(0), ext)
    const id = hex(6)
    await db.saveFile(id, blob, ext)
    const doc = {
      id,
      title: name.replace(/\.[^.]+$/, '') || '未命名文档',
      filename: name,
      kind,
      ext,
      pages,
      summary: '',
      bytes: buf.byteLength || buf.length || 0,
      createdAt: Date.now()
    }
    await db.saveDoc(doc)
    makeSummary(doc)
    return json({ doc: { id: doc.id, title: doc.title, kind: doc.kind, pages: pages.length } })
  }

  {
    const m = p.match(/^\/api\/doc\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      const doc = await db.getDoc(m[1])
      if (!doc) return json({ error: '文档不存在' }, 404)
      return json({ doc, tree: await db.getTree(m[1]) })
    }
    if (m && method === 'DELETE') {
      await db.deleteDoc(m[1])
      return json({ ok: true })
    }
  }

  if (p === '/api/ask' && method === 'POST') return handleAsk(init)

  if (p === '/api/highlights' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    doc.highlights = Array.isArray(body.highlights) ? body.highlights.slice(0, 3000) : []
    await db.saveDoc(doc)
    return json({ ok: true, count: doc.highlights.length })
  }

  if (p === '/api/node/delete' && method === 'POST') {
    const { docId, nodeId } = await bodyJson(init)
    const tree = await db.getTree(docId)
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
    await db.saveTree(docId, tree)
    return json({ removed: [...kill] })
  }

  {
    const m = p.match(/^\/api\/export\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      const doc = await db.getDoc(m[1])
      if (!doc) return json({ error: '文档不存在' }, 404)
      const md = treeToMarkdown(doc, await db.getTree(m[1]))
      return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
    }
  }

  return json({ error: 'not found' }, 404)
}

export function installFetchShim() {
  if (window.__DT_SHIM) return
  window.__DT_SHIM = true
  const orig = window.fetch.bind(window)
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || ''
    try {
      if (url.startsWith('/api/')) return handleApi(url, init)
    } catch (e) {
      return Promise.reject(e)
    }
    return orig(input, init)
  }
}

export async function downloadExport(docId) {
  const doc = await db.getDoc(docId)
  if (!doc) return
  const md = treeToMarkdown(doc, await db.getTree(docId))
  const name = `${doc.title}-追问树.md`
  if (window.DocTreeAndroid && window.DocTreeAndroid.saveText) {
    window.DocTreeAndroid.saveText(name, md)
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
