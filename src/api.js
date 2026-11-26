// 本地 API：把前端的 /api/* 请求映射到 IndexedDB + 浏览器内解析 + 模型代理
import * as db from './db.js'
import { extract } from './extract.js'
import { publicConfig, readConfig, writeConfig } from './config.js'
import { chat, streamChat, streamChatWithTools, ocrImage, webResearch } from './llm.js'
import { webToolSpecs, searchWeb, fetchWeb } from './websearch.js'
import { buildAskMessages, buildSummaryMessages, treeToMarkdown, TOOL_SPECS, execTool } from './context.mjs'

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
  if (doc.kind === 'image') return
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

async function imageDocDataUrl(doc) {
  try {
    const f = await db.getFile(doc.id)
    if (!f?.blob) return null
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }[doc.ext] || 'image/png'
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || '').replace(/^data:[^;]+/, 'data:' + mime))
      r.onerror = () => resolve(null)
      r.readAsDataURL(f.blob)
    })
  } catch {
    return null
  }
}

async function execWithPageImage(docs, docId, name, args) {
  const out = await execTool(docs, docId, name, args)
  if (name === 'read_page' && args && args.page) {
    try {
      const img = await globalThis.__dtPageImage?.(Number(args.page))
      if (img) return { text: out, image: img }
    } catch {}
  }
  return out
}

async function handleAsk(init) {
  const body = await bodyJson(init)
  const doc = await db.getDoc(body.docId)
  if (!doc) return json({ error: '文档不存在' }, 404)

  if (!doc.summary) makeSummary(doc)

  const group = groupOfDoc(doc.id)
  let docs = [doc]
  if (group) docs = (await Promise.all(group.docIds.map((id) => db.getDoc(id)))).filter(Boolean)

  const tree = await docTree(body.docId)
  const cfg = readConfig()
  const id = hex(6)
  let pageImage = body.image || null
  if (!pageImage && (doc.kind === 'pdf' || doc.kind === 'image')) {
    try {
      pageImage = doc.kind === 'image' ? await imageDocDataUrl(doc) : await globalThis.__dtPageImage?.(body.anchor?.page || 1)
    } catch {}
  }
  if (body.web && !/deepseek\.com/i.test(String(cfg.baseUrl))) {
    return json({ error: '联网搜索仅支持 DeepSeek 官方接口' }, 400)
  }
  const webSearch = Boolean(body.web)
  const useModel = pageImage ? cfg.visionModel || cfg.model : cfg.model
  const provider = pageImage
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
  await saveDocTree(body.docId, tree)

  const ac = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    try { ac.abort() } catch {}
  }, 120000)
  const onAbort = () => ac.abort()
  if (init?.signal) {
    if (init.signal.aborted) ac.abort()
    else init.signal.addEventListener('abort', onAbort, { once: true })
  }

  return sseResponse(async (send) => {
    send({ type: 'meta', node })
    const addSources = (list) => {
      const seen = new Set((node.sources || []).map((x) => x.url))
      for (const x of Array.isArray(list) ? list : []) {
        const c = x.url_citation || x
        if (!c.url || seen.has(c.url)) continue
        seen.add(c.url)
        ;(node.sources ||= []).push({ url: c.url, title: c.title || c.url })
      }
      if (node.sources?.length) send({ type: 'web-sources', sources: node.sources })
    }
    try {
      const messages = buildAskMessages({ docs, tree, node, image: pageImage, webSearch })
      const usage = await streamChatWithTools(
        messages,
        (d) => {
          node.answer += d
          send({ type: 'delta', text: d })
        },
        {
          signal: ac.signal,
          model: useModel,
          provider,
          specs: webSearch ? [...TOOL_SPECS, ...webToolSpecs()] : TOOL_SPECS,
          exec: async (name, args) => {
            if (name === 'web_search' && webSearch) {
              send({ type: 'web', status: 'searching' })
              const r = await searchWeb(cfg, args)
              addSources(r.sources)
              return JSON.stringify({ results: r.results })
            }
            if (name === 'web_fetch' && webSearch) {
              send({ type: 'web', status: 'reading' })
              const r = await fetchWeb(cfg, args)
              addSources(r.sources)
              return JSON.stringify({ title: r.title, url: r.url, content: r.content })
            }
            return execWithPageImage(docs, doc.id, name, args)
          },
          onTool: (t) => send({ type: 'tool', name: t.name, args: t.args }),
          onReasoning: (t) => {
            node.reasoning = (node.reasoning || '') + t
            send({ type: 'reasoning', text: t })
          }
        }
      )
      if (usage) {
        node.usage = usage
        send({ type: 'usage', usage })
      }
      if (node.sources?.length) {
        const seen = new Set()
        const uniq = node.sources.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
        const extra = '\n\n---\n**来源**\n' + uniq.map((x) => `- [${x.title || x.url}](${x.url})`).join('\n')
        node.answer += extra
        send({ type: 'delta', text: extra })
      }
    } catch (e) {
      if (timedOut) {
        node.error = '请求超时（120 秒），已中止'
        send({ type: 'error', message: node.error })
      } else if (ac.signal.aborted) {
        node.stopped = true
        send({ type: 'stopped' })
      } else {
        node.error = String(e.message || e)
        send({ type: 'error', message: node.error })
      }
    }
    clearTimeout(timeout)
    if (init?.signal) init.signal.removeEventListener('abort', onAbort)
    if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)
    delete node.status
    await saveDocTree(body.docId, tree)
    send({ type: 'done', node })
  })
}

async function sha256hex(buf) {
  const data = buf instanceof ArrayBuffer ? buf : buf.buffer
  const d = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------- 文档组（移动端：localStorage + 组树存 trees 库） ----------
const GROUPS_KEY = 'dt:groups'
function readGroups() {
  try {
    const g = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]')
    return Array.isArray(g) ? g : []
  } catch {
    return []
  }
}
function writeGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}
function groupOfDoc(docId) {
  return readGroups().find((g) => g.docIds.includes(docId)) || null
}
async function docTree(docId) {
  const g = groupOfDoc(docId)
  return db.getTree(g ? 'group:' + g.id : docId)
}
async function saveDocTree(docId, tree) {
  const g = groupOfDoc(docId)
  await db.saveTree(g ? 'group:' + g.id : docId, tree)
}

async function handleApi(path, init) {
  const method = (init?.method || 'GET').toUpperCase()
  const p = new URL(path, location.href).pathname

  if (p === '/api/state' && method === 'GET') {
    const groups = readGroups()
    const flags = (() => { try { return JSON.parse(localStorage.getItem('dt:flags') || '{}') } catch { return {} } })()
    const docs = (await db.listDocs()).map((d) => ({
      ...d,
      groupId: groups.find((g) => g.docIds.includes(d.id))?.id || null
    }))
    return json({ docs, groups, flags, config: publicConfig() })
  }

  if (p === '/api/usage' && method === 'GET') {
    const docs = await db.listDocsRaw()
    const groups = readGroups()
    const groupName = new Map(groups.map((g) => [g.id, g.name]))
    const seen = new Set()
    const totals = { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0, rounds: 0 }
    const dayMap = new Map()
    const docMap = new Map()
    const dayKey = (t2) => {
      const d = new Date(t2)
      const p2 = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
    }
    for (const doc of docs) {
      const key = doc.groupId || doc.id
      if (seen.has(key)) continue
      seen.add(key)
      const tree = await docTree(doc.id)
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
        if (!docMap.has(key)) docMap.set(key, { title: doc.groupId ? groupName.get(doc.groupId) || doc.title : doc.title, total: 0, cacheHit: 0, cacheMiss: 0, requests: 0 })
        const dm = docMap.get(key)
        dm.total += u.total || (u.input || 0) + (u.output || 0)
        dm.cacheHit += u.cacheHit || 0
        dm.cacheMiss += u.cacheMiss || 0
        dm.requests += 1
      }
    }
    const hitRate = totals.cacheHit + totals.cacheMiss > 0 ? totals.cacheHit / (totals.cacheHit + totals.cacheMiss) : 0
    return json({
      totals: { ...totals, hitRate },
      days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
      docs: [...docMap.values()].sort((a, b) => b.total - a.total).slice(0, 8)
    })
  }

  if (p === '/api/config' && method === 'POST') {
    const body = await bodyJson(init)
    const patch = {}
    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl', 'apiFormat', 'visionFormat']) {
      if (typeof body[k] === 'string' && body[k].trim()) patch[k] = body[k].trim()
    }
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()
    if (typeof body.visionApiKey === 'string' && body.visionApiKey.trim()) patch.visionApiKey = body.visionApiKey.trim()
    if (body.visionBaseUrl === '') patch.visionBaseUrl = ''
    if (['low', 'high', 'max'].includes(body.effort)) patch.effort = body.effort
    writeConfig(patch)
    return json({ config: publicConfig() })
  }

  if (p === '/api/import' && method === 'POST') {
    const name = decodeURIComponent(headerOf(init, 'x-filename') || 'document')
    const buf = await bodyBytes(init)
    const ext = (name.match(/\.[^.]+$/) || [''])[0].toLowerCase()
    if (!['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
      return json({ error: `暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX / 图片` }, 415)
    }
    // pdf.js 会把传入的 ArrayBuffer transfer 掉，先固化成 Blob 再解析
    const blob = new Blob([buf])
    const hash = await sha256hex(buf)

    // 同一份文件再次导入（可能之前被移出列表）→ 复用原文档，提问树还在
    for (const d of await db.listDocsRaw()) {
      let h = d.hash
      if (!h) {
        try {
          const f = await db.getFile(d.id)
          if (f?.blob) {
            h = await sha256hex(await f.blob.arrayBuffer())
            d.hash = h
            await db.saveDoc(d)
          }
        } catch {}
      }
      if (h !== hash) continue
      d.hidden = false
      d.filename = name
      d.updatedAt = Date.now()
      await db.saveDoc(d)
      return json({ doc: { id: d.id, title: d.title, kind: d.kind, pages: (d.pages || []).length }, revived: true })
    }

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
      hash,
      hidden: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await db.saveDoc(doc)
    if (kind === 'image') {
      try {
        const dataUrl = await imageDocDataUrl(doc)
        const text = await ocrImage(dataUrl)
        if (text) {
          doc.pages[0].text = text
          doc.ocr = true
          await db.saveDoc(doc)
        }
      } catch (e) {
        console.warn('[ocr]', e)
      }
    }
    makeSummary(doc)
    return json({ doc: { id: doc.id, title: doc.title, kind: doc.kind, pages: pages.length } })
  }

  if (p === '/api/flags' && method === 'POST') {
    const body = await bodyJson(init)
    let flags = {}
    try {
      flags = JSON.parse(localStorage.getItem('dt:flags') || '{}')
    } catch {}
    for (const k of ['welcomeSeen', 'guideSeen']) if (typeof body[k] === 'boolean') flags[k] = body[k]
    localStorage.setItem('dt:flags', JSON.stringify(flags))
    return json({ flags })
  }

  if (p === '/api/group' && method === 'POST') {
    const body = await bodyJson(init)
    const ids = Array.isArray(body.docIds) ? body.docIds.filter(Boolean).slice(0, 50) : []
    if (ids.length < 2) return json({ error: '至少选择两份文档' }, 400)
    const groups = readGroups()
    const id = hex(4)
    const nodes = {}
    for (const docId of ids) {
      const own = await db.getTree(docId)
      Object.assign(nodes, own.nodes || {})
    }
    await db.saveTree('group:' + id, { nodes })
    for (const g of groups) g.docIds = g.docIds.filter((d) => !ids.includes(d))
    const kept = groups.filter((g) => g.docIds.length >= 2)
    kept.push({ id, name: String(body.name || '').trim() || `组 ${kept.length + 1}`, docIds: [...ids], createdAt: Date.now() })
    writeGroups(kept)
    return json({ group: kept[kept.length - 1] })
  }

  if (p === '/api/group/update' && method === 'POST') {
    const body = await bodyJson(init)
    const groups = readGroups()
    const g = groups.find((x) => x.id === body.id)
    const add = Array.isArray(body.add) ? body.add.filter(Boolean) : []
    const remove = Array.isArray(body.remove) ? body.remove.filter(Boolean) : []
    if (!g) return json({ group: null, dissolved: true })
    if (typeof body.name === 'string' && body.name.trim()) g.name = body.name.trim()
    const tree = await db.getTree('group:' + g.id)
    for (const docId of remove) {
      await db.saveTree(docId, tree)
    }
    g.docIds = g.docIds.filter((d) => !remove.includes(d))
    for (const docId of add) {
      const own = await db.getTree(docId)
      Object.assign(tree.nodes, own.nodes || {})
      for (const other of groups) if (other.id !== g.id) other.docIds = other.docIds.filter((d) => d !== docId)
      if (!g.docIds.includes(docId)) g.docIds.push(docId)
    }
    await db.saveTree('group:' + g.id, tree)
    // 少于 2 份自动解散
    for (const x of [...groups]) {
      if (x.docIds.length >= 2) continue
      const tx = await db.getTree('group:' + x.id)
      for (const docId of x.docIds) await db.saveTree(docId, tx)
      groups.splice(groups.indexOf(x), 1)
    }
    writeGroups(groups)
    return json({ group: groups.find((x) => x.id === g.id) || null, dissolved: !groups.some((x) => x.id === g.id) })
  }

  if (p === '/api/group/dissolve' && method === 'POST') {
    const body = await bodyJson(init)
    const groups = readGroups()
    const g = groups.find((x) => x.id === body.id)
    if (!g) return json({ error: '组不存在' }, 404)
    const tree = await db.getTree('group:' + g.id)
    for (const docId of g.docIds) await db.saveTree(docId, tree)
    writeGroups(groups.filter((x) => x.id !== g.id))
    return json({ ok: true })
  }

  if (p === '/api/doc/restore' && method === 'POST') {
    const body = await bodyJson(init)
    await db.setHidden(body.id, false)
    return json({ ok: true })
  }

  if (p === '/api/doc/purge' && method === 'POST') {
    const body = await bodyJson(init)
    await db.deleteDoc(body.id)
    return json({ ok: true })
  }

  {
    const m = p.match(/^\/api\/doc\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      const doc = await db.getDoc(m[1])
      if (!doc) return json({ error: '文档不存在' }, 404)
      return json({ doc, tree: await docTree(m[1]) })
    }
    if (m && method === 'DELETE') {
      await db.setHidden(m[1], true)
      const groups = readGroups()
      let changed = false
      for (const g of groups) {
        if (!g.docIds.includes(m[1])) continue
        g.docIds = g.docIds.filter((d) => d !== m[1])
        changed = true
      }
      if (changed) writeGroups(groups.filter((g) => g.docIds.length > 0))
      return json({ ok: true, hidden: true })
    }
  }

  if (p === '/api/instruction/remove' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    if (body.clear) doc.instructions = []
    else {
      const list = Array.isArray(doc.instructions) ? doc.instructions : []
      const i = Number(body.index)
      if (Number.isInteger(i) && i >= 0 && i < list.length) list.splice(i, 1)
      doc.instructions = list
    }
    await db.saveDoc(doc)
    return json({ ok: true, count: doc.instructions.length, instructions: doc.instructions })
  }

  if (p === '/api/instruction' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    const text = String(body.text || '').trim().slice(0, 500)
    if (!text) return json({ error: '指令不能为空' }, 400)
    if (/^(清除|清空).*指令$/.test(text)) {
      doc.instructions = []
      await db.saveDoc(doc)
      return json({ ok: true, count: 0, reply: '已清除所有指令' })
    }
    const cfg = readConfig()
    if (!cfg.apiKey) return json({ error: '未配置 API Key' }, 400)
    let reply = ''
    try {
      const s = await chat(
        [
          { role: 'system', content: '你是「文档树」的指令接收器。用户会给出关于后续回答方式的指令。只回复一句简短确认（不超过 20 字），不要解释、不要重复指令。' },
          { role: 'user', content: text }
        ],
        { maxTokens: 60 }
      )
      reply = String(s || '').trim().slice(0, 60)
    } catch {}
    doc.instructions = [...(doc.instructions || []), text].slice(-20)
    await db.saveDoc(doc)
    return json({ ok: true, count: doc.instructions.length, reply })
  }

  if (p === '/api/ask/resume' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    const cfg = readConfig()
    if (!cfg.apiKey) return json({ error: '未配置 API Key' }, 400)
    const group = groupOfDoc(doc.id)
    let docs = [doc]
    if (group) docs = (await Promise.all(group.docIds.map((id) => db.getDoc(id)))).filter(Boolean)
    const tree = await docTree(body.docId)
    const node = tree.nodes[body.nodeId]
    if (!node) return json({ error: '这条回答不存在' }, 404)

    let resumeImage = null
    if (doc.kind === 'pdf') {
      try {
        resumeImage = doc.kind === 'image' ? await imageDocDataUrl(doc) : await globalThis.__dtPageImage?.(node.anchor?.page || 1)
      } catch {}
    }
    const messages = buildAskMessages({ docs, tree, node, image: resumeImage })
    messages.push({ role: 'assistant', content: node.answer || '（还没有任何内容）' })
    messages.push({ role: 'user', content: '（上面的回答被中断了。请从断点处继续写，不要重复已有内容，也不要重新开头。）' })

    return sseResponse(async (send) => {
      send({ type: 'meta', node })
      try {
        const usage = await streamChatWithTools(
          messages,
          (d) => {
            node.answer += d
            send({ type: 'delta', text: d })
          },
          {
            model: resumeImage ? cfg.visionModel || node.model || cfg.model : node.model || cfg.model,
            provider: resumeImage
              ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }
              : null,
            specs: TOOL_SPECS,
            exec: (name, args) => execWithPageImage(docs, doc.id, name, args),
            onTool: (t2) => send({ type: 'tool', name: t2.name, args: t2.args }),
            onReasoning: (t2) => {
              node.reasoning = (node.reasoning || '') + t2
              send({ type: 'reasoning', text: t2 })
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
          send({ type: 'usage', usage: node.usage })
        }
        delete node.stopped
      } catch (e) {
        node.stopped = true
        send({ type: 'stopped' })
      }
      if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)
      delete node.status
      await saveDocTree(body.docId, tree)
      send({ type: 'done', node })
    })
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
    const tree = await docTree(docId)
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
    await saveDocTree(docId, tree)
    return json({ removed: [...kill] })
  }

  {
    const m = p.match(/^\/api\/export\/([0-9a-f]+)$/)
    if (m && method === 'GET') {
      const doc = await db.getDoc(m[1])
      if (!doc) return json({ error: '文档不存在' }, 404)
      const md = treeToMarkdown(doc, await docTree(m[1]))
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
  const md = treeToMarkdown(doc, await docTree(docId))
  const name = `${doc.title}-追问树.md`
  if (window.DocTreeAndroid && window.DocTreeAndroid.saveText) {
    window.DocTreeAndroid.saveText(name, md)
    return
  }
  const blobUrl = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
  // iOS Safari 对 blob 的 download 支持不稳，直接新开一页让用户「存储到文件」
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    const w = window.open(blobUrl, '_blank')
    if (!w) location.href = blobUrl
    return
  }
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
