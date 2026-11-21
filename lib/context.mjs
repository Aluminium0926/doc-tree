// 上下文组装：全文摘要、相关段落检索、追问链
const MAX_SUMMARY_SRC = 16000

function tokens(s) {
  const out = new Set()
  const lower = String(s || '').toLowerCase()
  for (const m of lower.matchAll(/[a-z0-9_]{2,}/g)) out.add(m[0])
  const cjk = lower.match(/[\u4e00-\u9fff]+/g) || []
  for (const run of cjk) {
    for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2))
  }
  return [...out]
}

export function splitChunks(doc, size = 700) {
  const chunks = []
  for (const p of doc.pages || []) {
    const text = p.text || ''
    if (!text.trim()) continue
    // 优先按段落/句子边界切，避免把一句话切成两半
    const parts = text.split(/(?<=[。！？!?；;])\s+|\n{2,}/).filter((s) => s && s.trim())
    let buf = ''
    const flush = () => {
      if (buf.trim()) chunks.push({ page: p.no, text: buf.trim() })
      buf = ''
    }
    for (let part of parts) {
      while (part.length > size) {
        flush()
        chunks.push({ page: p.no, text: part.slice(0, size) })
        part = part.slice(size)
      }
      if ((buf + part).length > size) flush()
      buf += (buf ? '\n' : '') + part
    }
    flush()
  }
  return chunks
}

export function rankChunks(chunks, query, k = 4) {
  const qs = tokens(query)
  if (!qs.length) return chunks.slice(0, k)
  const scored = chunks.map((c) => {
    const t = c.text.toLowerCase()
    let score = 0
    for (const q of qs) {
      let at = 0
      let hits = 0
      while ((at = t.indexOf(q, at)) !== -1 && hits < 6) {
        hits++
        at += q.length
      }
      if (hits) score += 1 + Math.log(hits)
    }
    return { ...c, score: score / Math.sqrt(c.text.length + 200) }
  })
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}

export function chainOf(tree, parentId) {
  const out = []
  let cur = parentId ? tree.nodes[parentId] : null
  let guard = 0
  while (cur && guard++ < 30) {
    out.unshift(cur)
    cur = cur.parentId ? tree.nodes[cur.parentId] : null
  }
  return out
}

function locate(pageText, quote) {
  if (!quote) return -1
  const t = pageText || ''
  let i = t.indexOf(quote)
  if (i >= 0) return i
  const norm = (s) => s.replace(/\s+/g, '')
  const nq = norm(quote)
  if (!nq) return -1
  const nt = norm(t)
  const j = nt.indexOf(nq)
  if (j < 0) return -1
  // 近似映射回原文位置
  let count = 0
  for (let k = 0; k < t.length; k++) {
    if (!/\s/.test(t[k])) {
      if (count === j) return k
      count++
    }
  }
  return -1
}

export function buildSummaryMessages(doc) {
  let src = ''
  for (const p of doc.pages || []) {
    src += `\n[第${p.no}页]\n${p.text}`
    if (src.length > MAX_SUMMARY_SRC) break
  }
  return [
    {
      role: 'system',
      content: '你是文档分析助手。只输出结构化的中文摘要，不要客套话。'
    },
    {
      role: 'user',
      content: `请为下面的文档写一份供后续问答使用的摘要，包含：
1) 主题与体裁（论文/教材/合同/报告…）
2) 结构脉络（分几部分，各讲什么）
3) 关键概念与术语
4) 作者的核心主张或结论
控制在 400 字以内，用 Markdown 短列表。

文档：
${src.slice(0, MAX_SUMMARY_SRC)}`
    }
  ]
}

function trim(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}


function pageScore(text, qs) {
  const t = String(text || '').toLowerCase()
  let score = 0
  for (const q of qs) {
    let at = 0
    let hits = 0
    while ((at = t.indexOf(q, at)) !== -1 && hits < 4) {
      hits++
      at += q.length
    }
    if (hits) score += 1 + Math.log(hits)
  }
  return score / Math.sqrt(t.length + 200)
}


export const TOOL_SPECS = [
  {
    name: 'read_page',
    description: '读取某份文档指定页的完整原文。用户提到“第 N 页”、或需要引用未提供的页面时使用。',
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: '页码，从 1 开始' },
        doc: { type: 'string', description: '文档标题里的关键词；省略则用当前文档' }
      },
      required: ['page']
    }
  },
  {
    name: 'read_pages',
    description: '一次读取连续几页的原文（最多 3 页），跨页推导时用。',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'integer', description: '起始页，从 1 开始' },
        to: { type: 'integer', description: '结束页（含），最多到 from+2' },
        doc: { type: 'string', description: '文档标题关键词；省略则用当前文档' }
      },
      required: ['from']
    }
  },
  {
    name: 'search_docs',
    description: '在当前文档或整个文档组里按关键词检索相关段落，返回命中的文档、页码和原文。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词或短语' },
        doc: { type: 'string', description: '限定某份文档（标题关键词），省略则搜全组' }
      },
      required: ['query']
    }
  },
  {
    name: 'list_docs',
    description: '列出当前组内所有文档的标题、页数，用于确认有哪些文档可读。',
    parameters: { type: 'object', properties: {} }
  }
]

function pickDoc(docs, q, fallbackId) {
  if (q) {
    const hit = docs.find((d) => String(d.title || '').toLowerCase().includes(String(q).toLowerCase()))
    if (hit) return hit
  }
  return docs.find((d) => d.id === fallbackId) || docs[0]
}

export function execTool(docs, defaultDocId, name, args = {}) {
  if (!docs || !docs.length) return '当前没有可读文档'
  if (name === 'list_docs') {
    return docs.map((d) => `《${d.title}》（${(d.pages || []).length} 页）`).join('\n')
  }
  if (name === 'read_page') {
    const d = pickDoc(docs, args.doc, defaultDocId)
    const page = Number(args.page)
    const p = (d.pages || []).find((x) => x.no === page)
    if (!p || !(p.text || '').trim()) {
      return `《${d.title}》第 ${page} 页没有文字层（可能是扫描件），共 ${(d.pages || []).length} 页。`
    }
    return `《${d.title}》第 ${page} 页：\n${p.text.slice(0, 5000)}`
  }
  if (name === 'read_pages') {
    const d = pickDoc(docs, args.doc, defaultDocId)
    const from = Math.max(1, Number(args.from) || 1)
    const to = Math.min(Number(args.to) || from, from + 2)
    const pages = (d.pages || []).filter((p) => p.no >= from && p.no <= to)
    if (!pages.length) return `《${d.title}》没有第 ${from}–${to} 页（共 ${(d.pages || []).length} 页）`
    let out = ''
    for (const p of pages) {
      if (!(p.text || '').trim()) continue
      if (out.length + p.text.length > 9000) break
      out += `[第${p.no}页]\n${p.text.slice(0, 3500)}\n\n`
    }
    return out.trim() ? `《${d.title}》第 ${from}–${to} 页：\n${out.trim()}` : `第 ${from}–${to} 页没有文字层`
  }
  if (name === 'search_docs') {
    const query = String(args.query || '').trim()
    if (!query) return '缺少检索词'
    const pool = args.doc ? [pickDoc(docs, args.doc, defaultDocId)] : docs
    const chunks = []
    for (const d of pool) {
      for (const c of splitChunks(d)) chunks.push({ ...c, title: d.title, docId: d.id })
    }
    const hits = rankChunks(chunks, query, 5)
    if (!hits.length) return `没有检索到与「${query}」相关的内容`
    return hits
      .map((c, i) => {
        const d = docs.find((x) => x.id === c.docId)
        let extra = ''
        if (d && i < 3) {
          const prev = (d.pages || []).find((p) => p.no === c.page - 1)
          const next = (d.pages || []).find((p) => p.no === c.page + 1)
          if (prev?.text?.trim()) extra += `\n（上一页开头：${prev.text.trim().slice(0, 160)}…）`
          if (next?.text?.trim()) extra += `\n（下一页开头：${next.text.trim().slice(0, 160)}…）`
        }
        return `《${c.title}》第${c.page}页：\n${c.text.slice(0, 900)}${extra}`
      })
      .join('\n\n---\n\n')
  }
  return `未知工具：${name}`
}

export function buildAskMessages({ doc, docs, tree, node, image }) {
  const all = (Array.isArray(docs) && docs.length ? docs : doc ? [doc] : []).filter(Boolean)
  const anchorDoc = all.find((d) => d.id === node.docId) || all[0] || { id: '', title: '文档', pages: [] }
  const anchor = node.anchor || {}
  const quote = (anchor.quote || '').trim()
  const parentNode = node.parentId ? tree.nodes?.[node.parentId] : null
  const followAnswer = anchor.kind === 'answer'
  const pageNo = anchor.page || parentNode?.anchor?.page || 1
  const page = (anchorDoc.pages || []).find((p) => p.no === pageNo)
  const pageText = page?.text || ''
  const multi = all.length > 1
  const free = Boolean(anchor.free) || followAnswer

  // 选中处附近原文 / 整页正文
  let nearby = ''
  if (quote) {
    const at = locate(pageText, quote)
    if (at >= 0) {
      nearby = pageText.slice(Math.max(0, at - 1200), at + quote.length + 1200)
    } else {
      nearby = pageText.slice(0, 2400)
    }
  } else if (anchor.kind === 'doc' && !free) {
    nearby = pageText.slice(0, 2400)
  }

  // 跨文档检索
  const chunks = []
  for (const d of all) {
    for (const c of splitChunks(d)) chunks.push({ ...c, title: d.title, docId: d.id })
  }
  const ranked = rankChunks(chunks, `${quote}\n${node.question}`, 6)
  const topScore = ranked[0]?.score || 0
  const related = ranked
    .filter((c) => topScore > 0 && c.score >= Math.max(0.02, topScore * 0.35))
    .filter((c) => !(c.docId === anchorDoc.id && c.page === pageNo && nearby.includes(c.text.slice(0, 40))))
    .slice(0, 2)

  const chain = chainOf(tree, node.parentId).slice(-4)
  const chainText = chain
    .map((n, i) => {
      const q = trim(n.quote || n.anchor?.quote, 160)
      // 最后一条（直接父节点）给更长，方便追问证明；更早的只留要点
      const limit = i === chain.length - 1 ? 800 : 250
      return `${i + 1}. 选中「${q}」→ 问：${trim(n.question, 160)}\n   答：${trim(n.answer, limit)}`
    })
    .join('\n')

  const titles = all.map((d) => `《${d.title}》`).join('、')
  const mode = followAnswer ? 'follow' : quote ? 'selection' : free ? 'free' : 'page'

  // 固定不变的 system：所有文档/模式/指令共用，方便服务端做前缀缓存
  const system = `你是「文档树」阅读助手。用户会提供文档信息、摘要和本轮要求，请据此回答。
要求：
- 遵守用户消息里的【本轮要求】。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\(...\\) 或 \\[...\\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记、背诵表、失分点等），除非用户明确要求。
- 可用工具：read_page(page, doc?) 读任意页、search_docs(query, doc?) 检索、list_docs() 看组内文档。
- 用户点名页码或需要原样引用时先 read_page；不确定内容在哪时先 search_docs。
- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。
- 如果用户消息附带截图，结合图中的图表、公式和排版回答；截图与文字层冲突时以截图为准。`

  const modeRules = {
    selection: `- 先给 1–2 句直接结论，再展开解释；引用原文时标注页码。
- 只解释选中的这段文字：它在说什么、为什么这样说。
- 摘要和相关段落只用于保证准确，不要在回答里复述「在全文中的位置/作用」这类结构性内容。`,
    page: `- 先给 1–2 句直接结论，再按页面内容展开（定义、符号、例子）。
- 这一页可能有多块内容，按逻辑顺序讲，不要逐字念稿。
- 需要引用本页或别页原文时，调用工具读取。`,
    free: `- 用户没有选中文字，问题范围由你判断：先确定要读哪几页、搜什么，再回答。
- 需要原文时先调用工具（search_docs / read_page），不要凭摘要猜，也不要预设只讲当前页。`,
    follow: `- 这是对上一条回答的追问：先承接上文，再回答新问题。
- 需要引用原文时调用工具，不要预设文档第 1 页。`
  }[mode]

  const groupRule = multi ? '\n- 跨文档对照只在问题范围内，引用时注明《文档名》第 N 页。' : ''

  // ---------- user：稳定段（可缓存） / 易变段 ----------
  const stable = []
  const volatile = []

  if (multi) {
    stable.push(
      `【文档组（共 ${all.length} 份，共享提问树）】\n` +
        all.map((d) => `《${d.title}》（${(d.pages || []).length} 页）`).join('\n')
    )
    const sums = all
      .filter((d) => d.summary)
      .map((d) => `《${d.title}》：${trim(d.summary, 500)}`)
      .join('\n')
    if (sums) stable.push(`【组内文档摘要】\n${sums}`)
    else stable.push(`【文档开头】\n${trim(all[0].pages?.[0]?.text || '', 1200)}`)
  } else {
    stable.push(`【文档】\n《${anchorDoc.title}》（${(anchorDoc.pages || []).length} 页）`)
    stable.push(
      anchorDoc.summary
        ? `【文档摘要】\n${anchorDoc.summary}`
        : `【文档开头】\n${trim(anchorDoc.pages?.[0]?.text || pageText, 1200)}`
    )
  }

  const instr = all.flatMap((d) => d.instructions || []).filter(Boolean).slice(-10)
  if (instr.length) {
    stable.push(`【用户附加指令（优先遵守）】\n${instr.map((x, i) => `${i + 1}. ${x}`).join('\n')}`)
  }

  volatile.push(`【本轮要求】\n${modeRules}${groupRule}`)

  if (followAnswer) {
    volatile.push('【本次是在追问上一条回答】')
  } else if (free) {
    volatile.push(`【用户没有选中文字；当前停留在第 ${pageNo} 页（只是位置提示，不能假定问题只关于这一页）】`)
  } else if (nearby) {
    const who = multi ? `《${anchorDoc.title}》` : ''
    volatile.push(`【${who}第 ${pageNo} 页${quote ? '，选中处上下文' : '，本页内容'}】\n${nearby}`)
  }

  if (related.length) {
    volatile.push(
      `【其他相关段落】\n` +
        related.map((c) => `- ${multi ? `《${c.title}》` : ''}第${c.page}页 ${trim(c.text, 500)}`).join('\n')
    )
  }
  if (chainText) volatile.push(`【本次追问所在的分支】\n${chainText}`)

  const askLines = []
  if (quote) {
    askLines.push(`我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`)
  } else if (followAnswer) {
    askLines.push('（继续追问上一条回答）')
  } else if (!free) {
    askLines.push(`请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`)
  }
  volatile.push([...askLines, `我的问题：${node.question || '请讲解这段内容'}`].join('\n'))

  const stableText = stable.join('\n\n')
  const volatileText = volatile.join('\n\n')
  const content = []
  if (image) {
    content.push({ type: 'text', text: '【截图】下面附带一张页面或框选区域的截图，请结合图像内容回答；文字层可能漏掉图表和公式。' })
    content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
  }
  content.push({ type: 'text', text: stableText + '\n\n' + volatileText })

  const userMsg = { role: 'user', content: content.length === 1 ? content[0].text : content }
  // Anthropic 缓存用：稳定段单独标记，不可枚举，不会进入 OpenAI 请求体
  Object.defineProperty(userMsg, '_stableText', { value: stableText, enumerable: false })
  Object.defineProperty(userMsg, '_volatileText', { value: volatileText, enumerable: false })

  return [{ role: 'system', content: system }, userMsg]
}

export function treeToMarkdown(doc, tree) {
  const nodes = Object.values(tree.nodes || {})
  const kids = new Map()
  for (const n of nodes) {
    const k = n.parentId || 'root'
    if (!kids.has(k)) kids.set(k, [])
    kids.get(k).push(n)
  }
  for (const arr of kids.values()) arr.sort((a, b) => a.createdAt - b.createdAt)

  const lines = [`# ${doc.title} · 追问树`, '']
  const walk = (parentId, depth) => {
    for (const n of kids.get(parentId) || []) {
      const pad = '  '.repeat(depth)
      const page = n.anchor?.page ? `（第 ${n.anchor.page} 页）` : ''
      if (n.anchor?.quote) lines.push(`${pad}- 「${trim(n.anchor.quote, 80)}」${page}`)
      lines.push(`${pad}  - **问**：${trim(n.question, 200)}`)
      const ans = String(n.answer || '').split('\n')
      for (const l of ans) lines.push(`${pad}    ${l}`)
      lines.push('')
      walk(n.id, depth + 1)
    }
  }
  walk('root', 0)
  return lines.join('\n')
}
