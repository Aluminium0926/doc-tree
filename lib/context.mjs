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
- 下面已经提供了文档全文或相关页/页面索引；只要其中有对应内容，就直接依据它回答，**不要声称没有拿到某页文字**。
- 若确实没有该页，再说明缺哪一页，并请用户贴出原文。
- **不要生成应试辅助内容**：不写「记忆抓手」「记忆口诀」「背诵表」「考点速记」「失分点」这类东西，也不要自行编造考点。除非用户明确要求。`

  // 用户问题里提到的页码：从所有文档里把这些页抓出来
  const refs = new Set()
  const qText = `${quote}\n${node.question || ''}`
  for (const m of qText.matchAll(/(\d{1,4})\s*页/g)) {
    const n = Number(m[1])
    if (n > 0) refs.add(n)
  }
  for (const m of qText.matchAll(/(?:page|p\.?)\s*(\d{1,4})/gi)) {
    const n = Number(m[1])
    if (n > 0) refs.add(n)
  }
  if (refs.size > 8) refs.clear()

  const pageLen = (d) => (d.pages || []).reduce((n, p) => n + (p.text || '').length, 0)
  const totalLen = all.reduce((n, d) => n + pageLen(d), 0)
  const FULL_BUDGET = 28000
  const full = totalLen > 0 && totalLen <= FULL_BUDGET

  const parts = []
  if (multi) {
    parts.push(
      `【文档组（共 ${all.length} 份，共享提问树）】\n` +
        all.map((d) => `《${d.title}》${full ? '：全文已附在下面' : ''}`).join('\n')
    )
  }

  for (const d of all) {
    const pages = d.pages || []
    if (!pages.length) continue

    if (full) {
      const body = pages
        .filter((p) => (p.text || '').trim())
        .map((p) => `[第${p.no}页]\n${p.text.slice(0, 5000)}`)
        .join('\n\n')
      if (body.trim()) parts.push(`【《${d.title}》全文】\n${body}`)
      continue
    }

    // 超长文档：锚点页、用户点名的页、按问题相关性挑出的页
    const qs = tokens(`${quote}\n${node.question || ''}`)
    const scored = pages
      .map((p) => ({ p, s: pageScore(p.text, qs) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.p)
    const pick = pages.filter(
      (p) =>
        refs.has(p.no) ||
        (d.id === anchorDoc.id && Math.abs(p.no - pageNo) <= 1) ||
        scored.includes(p)
    )
    if (pick.length) {
      const body = pick
        .map((p) => `[第${p.no}页]\n${p.text.slice(0, 5000)}`)
        .join('\n\n')
      parts.push(`【《${d.title}》相关页】\n${body}`)
    }

    const index = pages
      .map((p) => {
        const head = (p.text || '').replace(/\s+/g, ' ').slice(0, 46)
        return head ? `- 第${p.no}页：${head}` : ''
      })
      .filter(Boolean)
      .slice(0, 90)
    if (index.length) parts.push(`【《${d.title}》页面索引】\n${index.join('\n')}`)

    // 其余页给出开头一段，尽量覆盖“任意部分”
    const picked = new Set(pick.map((p) => p.no))
    const heads = []
    let headBudget = 12000
    for (const p of pages) {
      if (picked.has(p.no)) continue
      const txt = (p.text || '').trim()
      if (!txt) continue
      const take = txt.slice(0, 260)
      if (headBudget - take.length < 0) break
      headBudget -= take.length
      heads.push(`[第${p.no}页] ${take}`)
    }
    if (heads.length) parts.push(`【《${d.title}》各页开头】\n${heads.join('\n\n')}`)

    if (!multi && d.summary && !pick.length) {
      parts.push(`【文档摘要】\n${d.summary}`)
    }
  }

  if (multi) {
    const sums = all
      .filter((d) => d.summary)
      .map((d) => `《${d.title}》：${trim(d.summary, 500)}`)
      .join('\n')
    if (sums) parts.push(`【组内文档摘要】\n${sums}`)
  }

  if (!full) {
    if (nearby) {
      const who = multi ? `《${anchorDoc.title}》` : ''
      parts.push(`【${who}第 ${pageNo} 页${quote ? '，选中处上下文' : '，本页内容'}】\n${nearby}`)
    }
    if (related.length) {
      parts.push(
        `【其他相关段落】\n` +
          related.map((c) => `- ${multi ? `《${c.title}》` : ''}第${c.page}页 ${c.text}`).join('\n')
      )
    }
  }
  if (chainText) parts.push(`【本次追问所在的分支】\n${chainText}`)

  const ask = [
    quote
      ? `我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`
      : `请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`,
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
