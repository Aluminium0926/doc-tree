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
    if (!text) continue
    for (let i = 0; i < text.length; i += size) {
      const piece = text.slice(i, i + size)
      if (piece.trim()) chunks.push({ page: p.no, text: piece })
    }
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
  if (name === 'search_docs') {
    const query = String(args.query || '').trim()
    if (!query) return '缺少检索词'
    const pool = args.doc ? [pickDoc(docs, args.doc, defaultDocId)] : docs
    const chunks = []
    for (const d of pool) {
      for (const c of splitChunks(d)) chunks.push({ ...c, title: d.title })
    }
    const hits = rankChunks(chunks, query, 5)
    if (!hits.length) return `没有检索到与「${query}」相关的内容`
    return hits
      .map((c) => `《${c.title}》第${c.page}页：\n${c.text.slice(0, 900)}`)
      .join('\n\n---\n\n')
  }
  return `未知工具：${name}`
}

export function buildAskMessages({ doc, docs, tree, node, image }) {
  const all = (Array.isArray(docs) && docs.length ? docs : doc ? [doc] : []).filter(Boolean)
  const anchorDoc = all.find((d) => d.id === node.docId) || all[0] || { id: '', title: '文档', pages: [] }
  const anchor = node.anchor || {}
  const quote = (anchor.quote || '').trim()
  const pageNo = anchor.page || 1
  const page = (anchorDoc.pages || []).find((p) => p.no === pageNo)
  const pageText = page?.text || ''
  const multi = all.length > 1

  // 选中处附近原文 / 整页正文
  let nearby = ''
  if (quote) {
    const at = locate(pageText, quote)
    if (at >= 0) {
      nearby = pageText.slice(Math.max(0, at - 1200), at + quote.length + 1200)
    } else {
      nearby = pageText.slice(0, 2400)
    }
  } else if (anchor.kind === 'doc') {
    nearby = pageText.slice(0, 2400)
  }

  // 跨文档检索
  const chunks = []
  for (const d of all) {
    for (const c of splitChunks(d)) chunks.push({ ...c, title: d.title, docId: d.id })
  }
  const related = rankChunks(chunks, `${quote}\n${node.question}`, 4)
    .filter((c) => !(c.docId === anchorDoc.id && c.page === pageNo && nearby.includes(c.text.slice(0, 80))))
    .slice(0, 3)

  const chain = chainOf(tree, node.parentId)
  const chainText = chain
    .map((n, i) => {
      const q = trim(n.quote || n.anchor?.quote, 160)
      return `${i + 1}. 选中「${q}」→ 问：${trim(n.question, 160)}\n   答：${trim(n.answer, 500)}`
    })
    .join('\n')

  const titles = all.map((d) => `《${d.title}》`).join('、')
  const system = multi
    ? `你是「文档树」阅读助手。用户把 ${all.length} 份文档放进同一个组（${titles}），它们共享一棵提问树，问题可能跨文档。
要求：
- 先给 1–2 句直接结论，再展开解释；引用原文时注明来自哪份文档、第几页。
- 跨文档时可以做对照，但只在用户问到的范围内，不要罗列整组内容。
- 如果用户是在追问上一条回答，先承接上文，再回答新问题。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\(...\\) 或 \\[...\\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记等），除非用户明确要求。`
    : `你是「文档树」阅读助手。用户在阅读《${anchorDoc.title}》，通过划选文字向你提问。
要求：
- 先给 1–2 句直接结论，再展开解释；必要处引用原文，并标注页码。
- 解释要贴合这篇文档的语境，不要泛泛而谈教科书定义。
- 如果用户是在追问上一条回答，先承接上文，再回答新问题。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\(...\\) 或 \\[...\\] 的写法。
- 只解释这段文字本身：它在说什么、为什么这样说。
- 文档摘要和相关页只用来让你解释得准确，**不要在回答里复述**——不要写「在全文里的位置」「在全文中的作用」「与前后页的呼应」这类结构性小节，也不要按页罗列相关内容。确有必要提及其他页时，一句话带过。
- 你可以调用工具读取原文：read_page(page, doc?) 读任意页、search_docs(query, doc?) 检索、list_docs() 看组内文档。
- 需要某页原文、或不确定内容在哪时，**先调用工具再回答**，不要凭摘要猜，也不要声称拿不到某页——先 read_page。
- 已经在上文给出的内容不必重复读取。
- **不要生成应试辅助内容**：不写「记忆抓手」「记忆口诀」「背诵表」「考点速记」「失分点」这类东西，也不要自行编造考点。除非用户明确要求。`

  const parts = []
  if (multi) {
    parts.push(
      `【文档组（共 ${all.length} 份，共享提问树）】\n` +
        all.map((d) => `《${d.title}》（${(d.pages || []).length} 页）`).join('\n')
    )
    const sums = all
      .filter((d) => d.summary)
      .map((d) => `《${d.title}》：${trim(d.summary, 500)}`)
      .join('\n')
    if (sums) parts.push(`【组内文档摘要】\n${sums}`)
  } else if (anchorDoc.summary) {
    parts.push(`【文档摘要】\n${anchorDoc.summary}`)
  } else {
    parts.push(`【文档开头】\n${trim(pageText, 1200)}`)
  }

  if (nearby) {
    const who = multi ? `《${anchorDoc.title}》` : ''
    parts.push(`【${who}第 ${pageNo} 页${quote ? '，选中处上下文' : '，本页内容'}】\n${nearby}`)
  }
  if (related.length) {
    parts.push(
      `【其他相关段落】\n` +
        related.map((c) => `- ${multi ? `《${c.title}》` : ''}第${c.page}页 ${trim(c.text, 700)}`).join('\n')
    )
  }
  if (chainText) parts.push(`【本次追问所在的分支】\n${chainText}`)

  const ask = [
    quote
      ? `我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`
      : `请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`,
    `我的问题：${node.question || '请讲解这段内容'}`
  ].join('\n')

  const toolNote = `

工具（需要原文时先调用，不要凭摘要猜）：
- read_page(page, doc?)：读取任意一页的完整原文，page 从 1 开始
- search_docs(query, doc?)：在文档或组内按关键词检索
- list_docs()：查看组内有哪些文档
用户提到某页时先 read_page；不确定内容在哪时先 search_docs。`

  const content = []
  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
  content.push({ type: 'text', text: parts.join('\n\n') + '\n\n' + ask })

  return [
    { role: 'system', content: system + toolNote },
    { role: 'user', content: content.length === 1 ? content[0].text : content }
  ]
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
