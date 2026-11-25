// 提问 / 续写共用管线。
// 之前 handleAsk 和 handleResume 是两份复制粘贴，续写那份引用了不存在的 webSearch/addSources，
// 导致「继续」100% 报错。v153 起两条路由只走这一个函数。
import crypto from 'node:crypto'
import * as store from '../store.mjs'
import * as llm from '../llm.mjs'
import { buildAskMessages, buildSummaryMessages, execTool } from '../context.mjs'
import { webToolSpecs, searchWeb, fetchWeb } from '../websearch.mjs'
import { renderPageImage } from '../render.mjs'
import { json, openSSE } from '../http/respond.mjs'
import { assertDocId, BadRequest, NotFound } from '../ids.mjs'

const IDLE_TIMEOUT_MS = 90_000 // 多久没有任何增量就判定卡死
const TOTAL_TIMEOUT_MS = 10 * 60_000 // 单次回答的硬上限
const MAX_PAGE_IMAGES = 3 // 一次回答里最多附带几张页图（成本控制）

export function needWeb(cfg, body) {
  const web = Boolean(body?.web)
  if (web && !/deepseek\.com/i.test(String(cfg.baseUrl || ''))) {
    throw new BadRequest('联网搜索仅支持 DeepSeek 官方接口（把 Base URL 改回 api.deepseek.com）')
  }
  return web
}

// 前端随问题附上的图片（粘贴/框选）：只接受图片 dataURL，且限制大小（body 上限 2MB）
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/
const MAX_IMAGE_CHARS = 1_800_000

export function sanitizeImage(v) {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s.length > MAX_IMAGE_CHARS) return null
  if (!IMAGE_DATA_URL.test(s.replace(/\s+/g, ''))) return null
  return s.replace(/\s+/g, '')
}

// 页图策略：auto = 首问附当前页；工具读页只在文字层缺失时附；never = 全不附
function wantPageImage(cfg, reason) {
  const mode = cfg.pageImage || 'auto'
  if (mode === 'never') return false
  if (mode === 'always') return true
  return reason === 'ask' || reason === 'empty-text'
}

async function loadGroupDocs(doc) {
  const group = await store.groupOfDoc(doc.id)
  if (!group) return [doc]
  const list = await Promise.all((group.docIds || []).map((id) => store.getDoc(id).catch(() => null)))
  return list.filter(Boolean)
}

export async function runAsk(ctx, { resume = false } = {}) {
  const { res, body } = ctx
  const cfg = llm.readConfig()
  if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })

  const docId = assertDocId(body.docId)
  const doc = await store.getDoc(docId)
  if (!doc) return json(res, 404, { error: '文档不存在' })

  const docs = await loadGroupDocs(doc)
  const tree = await store.getTree(doc.id)

  let node
  let imagesLeft = MAX_PAGE_IMAGES
  let pageImage = null
  // 前端粘贴/框选随问题附上的图片优先于服务端渲染的页图
  const attached = sanitizeImage(body.image)
  let webSearch = false

  if (resume) {
    node = tree.nodes[body.nodeId]
    if (!node) return json(res, 404, { error: '这条回答不存在' })
    node.status = 'streaming'
    delete node.stopped
    delete node.error
    if (!node.hadImage && (doc.kind === 'pdf' || doc.kind === 'image') && wantPageImage(cfg, 'ask')) {
      pageImage = await renderPageImage(doc, node.anchor?.page || 1).catch(() => null)
      if (pageImage) imagesLeft--
    }
  } else {
    webSearch = needWeb(cfg, body)
    const anchor = body.anchor || { kind: 'doc', page: 1, quote: '' }
    const pageNo = anchor.page || 1
    if (attached) {
      pageImage = attached
      imagesLeft--
    } else if ((doc.kind === 'pdf' || doc.kind === 'image') && wantPageImage(cfg, 'ask')) {
      pageImage = await renderPageImage(doc, pageNo).catch((e) => {
        console.warn('[render]', e && e.message)
        return null
      })
      if (pageImage) imagesLeft--
    }
    node = {
      id: crypto.randomBytes(6).toString('hex'),
      docId: doc.id,
      parentId: body.parentId || null,
      anchor,
      question: String(body.question || '请讲解这段内容').slice(0, 2000),
      answer: '',
      model: pageImage ? cfg.visionModel || cfg.model : cfg.model,
      status: 'streaming',
      createdAt: Date.now()
    }
    if (attached) node.hadImage = true
    tree.nodes[node.id] = node
    await store.saveTree(doc.id, tree) // 先落盘：进程被杀也能在树里看到这条
  }

  // 摘要缺失时自愈（导入时服务被重启会留下没摘要的文档）
  if (!doc.summary) {
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

  const sse = openSSE(res)
  sse({ type: 'meta', node })

  const ac = new AbortController()
  let abortReason = ''
  let idleTimer = null
  const armIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      abortReason = 'idle'
      try { ac.abort() } catch {}
    }, IDLE_TIMEOUT_MS)
  }
  const hardTimer = setTimeout(() => {
    abortReason = abortReason || 'total'
    try { ac.abort() } catch {}
  }, TOTAL_TIMEOUT_MS)
  armIdle()
  const onClose = () => {
    abortReason = abortReason || 'client'
    try { ac.abort() } catch {}
  }
  // 只监听 res：req 的 close 在 body 读完时就会触发，会把正常请求误判成断开
  res.on('close', onClose)

  const addSources = (list) => {
    const seen = new Set((node.sources || []).map((x) => x.url))
    let added = false
    for (const a of Array.isArray(list) ? list : []) {
      const c = a.url_citation || a
      if (!c.url || seen.has(c.url)) continue
      seen.add(c.url)
      ;(node.sources ||= []).push({ url: c.url, title: c.title || c.url })
      added = true
    }
    if (added) sse({ type: 'web-sources', sources: node.sources })
  }

  const onDelta = (d) => {
    if (!d) return
    armIdle()
    node.answer = (node.answer || '') + d
    sse({ type: 'delta', text: d })
  }
  const onReasoning = (t) => {
    if (!t) return
    armIdle()
    node.reasoning = (node.reasoning || '') + t
    sse({ type: 'reasoning', text: t })
  }

  const exec = async (name, args) => {
    armIdle()
    if (name === 'web_search' && webSearch) {
      sse({ type: 'web', status: 'searching' })
      const r = await searchWeb(cfg, args)
      addSources(r.sources)
      return JSON.stringify({ results: r.results })
    }
    if (name === 'web_fetch' && webSearch) {
      sse({ type: 'web', status: 'reading' })
      const r = await fetchWeb(cfg, args)
      addSources(r.sources)
      return JSON.stringify({ title: r.title, url: r.url, content: r.content })
    }
    const out = await execTool(docs, doc.id, name, args)
    // 只有「这一页没有文字层」才补页图：以前每读一页都附整页截图，token 和费用都会翻倍
    if (name === 'read_page' && args?.page && imagesLeft > 0) {
      let target = docs.find((d) => d.id === doc.id) || docs[0]
      if (args.doc) {
        const q = String(args.doc).toLowerCase()
        target = docs.find((d) => (d.title || '').toLowerCase().includes(q)) || target
      }
      const page = (target?.pages || []).find((p) => p.no === Number(args.page))
      const emptyText = !page || String(page.text || '').trim().length < 120
      if (target && (target.kind === 'pdf' || target.kind === 'image') && wantPageImage(cfg, emptyText ? 'empty-text' : 'tool')) {
        const img = await renderPageImage(target, Number(args.page)).catch(() => null)
        if (img) {
          imagesLeft--
          return { text: out, image: img }
        }
      }
    }
    return out
  }

  const messages = resume
    ? (() => {
        const m = buildAskMessages({ doc, docs, tree, node, image: pageImage })
        m.push({ role: 'assistant', content: node.answer || '（还没有任何内容）' })
        m.push({ role: 'user', content: '（上面的回答被中断了。请从断点处继续写，不要重复已有内容，也不要重新开头；必要时调用工具补读原文。）' })
        return m
      })()
    : buildAskMessages({ doc, docs, tree, node, image: pageImage, webSearch })

  const provider = pageImage
    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat || cfg.apiFormat }
    : null

  try {
    const usage = await llm.streamChatWithTools(messages, onDelta, {
      signal: ac.signal,
      model: pageImage ? cfg.visionModel || node.model || cfg.model : node.model || cfg.model,
      provider,
      extraTools: webSearch ? webToolSpecs() : [],
      exec,
      onTool: (t) => {
        armIdle()
        sse({ type: 'tool', name: t.name, args: t.args })
      },
      onReasoning
    })
    if (usage) {
      const prev = resume ? node.usage || {} : {}
      node.usage = resume
        ? {
            input: (prev.input || 0) + usage.input,
            output: (prev.output || 0) + usage.output,
            cacheHit: (prev.cacheHit || 0) + usage.cacheHit,
            cacheMiss: (prev.cacheMiss || 0) + usage.cacheMiss,
            total: (prev.total || 0) + usage.total,
            rounds: (prev.rounds || 0) + (usage.rounds || 1)
          }
        : usage
      sse({ type: 'usage', usage: node.usage })
    }
    if (node.sources?.length) {
      const seen = new Set()
      const uniq = node.sources.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
      const extra = '\n\n---\n**来源**\n' + uniq.map((x) => `- [${x.title || x.url}](${x.url})`).join('\n')
      node.answer += extra
      sse({ type: 'delta', text: extra })
    }
    node.status = 'done'
    delete node.stopped
  } catch (e) {
    if (abortReason === 'idle') {
      node.status = 'error'
      node.error = `模型超过 ${Math.round(IDLE_TIMEOUT_MS / 1000)} 秒没有输出，已中止`
      sse({ type: 'error', message: node.error })
    } else if (abortReason === 'total') {
      node.status = 'error'
      node.error = '单次回答超过 10 分钟，已中止'
      sse({ type: 'error', message: node.error })
    } else if (abortReason === 'client' || ac.signal.aborted || e?.name === 'AbortError') {
      node.status = 'stopped'
      node.stopped = true
      sse({ type: 'stopped' })
    } else {
      node.status = 'error'
      node.error = String(e?.message || e)
      sse({ type: 'error', message: node.error })
    }
  } finally {
    clearTimeout(hardTimer)
    clearTimeout(idleTimer)
    sse.close()
    res.off('close', onClose)
  }

  if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)
  delete node.status
  try {
    await store.saveTree(doc.id, tree)
  } catch (e) {
    sse({ type: 'error', message: '保存失败：' + (e?.message || e) })
  }
  sse({ type: 'done', node })
  try {
    res.end()
  } catch {}
}
