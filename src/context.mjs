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

export function buildAskMessages({ doc, tree, node, image }) {
  const anchor = node.anchor || {}
  const quote = (anchor.quote || '').trim()
  const pageNo = anchor.page || 1
  const page = (doc.pages || []).find((p) => p.no === pageNo)
  const pageText = page?.text || ''

  // 选中处附近原文
  let nearby = ''
  if (quote) {
    const at = locate(pageText, quote)
    if (at >= 0) {
      nearby = pageText.slice(Math.max(0, at - 1200), at + quote.length + 1200)
    } else {
      nearby = pageText.slice(0, 2400)
    }
  }

  // 相关段落（跨页检索）
  const chunks = splitChunks(doc)
  const related = rankChunks(chunks, `${quote}\n${node.question}`, 4)
    .filter((c) => !(c.page === pageNo && nearby.includes(c.text.slice(0, 80))))
    .slice(0, 3)

  const chain = chainOf(tree, node.parentId)
  const chainText = chain
    .map((n, i) => {
      const q = trim(n.quote || n.anchor?.quote, 160)
      return `${i + 1}. 选中「${q}」→ 问：${trim(n.question, 160)}\n   答：${trim(n.answer, 500)}`
    })
    .join('\n')

  const system = `你是「文档树」阅读助手。用户在阅读《${doc.title}》，通过划选文字向你提问。
要求：
- 先给 1–2 句直接结论，再展开解释；必要处引用原文，并标注页码。
- 解释要贴合这篇文档的语境，不要泛泛而谈教科书定义。
- 如果用户是在追问上一条回答，先承接上文，再回答新问题。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \(...\) 或 \[...\] 的写法。
- 只解释这段文字本身：它在说什么、为什么这样说。
- 文档摘要和相关页只用来让你解释得准确，**不要在回答里复述**——不要写「在全文里的位置」「在全文中的作用」「与前后页的呼应」这类结构性小节，也不要按页罗列相关内容。确有必要提及其他页时，一句话带过。
- **不要生成应试辅助内容**：不写「记忆抓手」「记忆口诀」「背诵表」「考点速记」「失分点」这类东西，也不要自行编造考点。除非用户明确要求。`

  const parts = []
  if (doc.summary) parts.push(`【文档摘要】\n${doc.summary}`)
  else parts.push(`【文档开头】\n${pageText.slice(0, 3000)}`)
  if (nearby) parts.push(`【第 ${pageNo} 页，选中处上下文】\n${nearby}`)
  if (related.length) {
    parts.push(
      `【其他相关段落】\n` +
        related.map((c) => `- (第${c.page}页) ${c.text}`).join('\n')
    )
  }
  if (chainText) parts.push(`【本次追问所在的分支】\n${chainText}`)

  const ask = [
    quote ? `我选中了（第 ${pageNo} 页）：「${quote}」` : `（整篇文档提问）`,
    `我的问题：${node.question || '请讲解这段内容'}`
  ].join('\n')

  const content = []
  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
  content.push({ type: 'text', text: parts.join('\n\n') + '\n\n' + ask })

  return [
    { role: 'system', content: system },
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
