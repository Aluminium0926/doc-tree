import fs from 'node:fs'

const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
const start = t.indexOf('export function buildAskMessages')
const end = t.indexOf('export function treeToMarkdown')
if (start < 0 || end < 0) throw new Error('markers not found')

const fn = `export function buildAskMessages({ doc, docs, tree, node, image }) {
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
  const related = rankChunks(chunks, \`\${quote}\\n\${node.question}\`, 4)
    .filter((c) => !(c.docId === anchorDoc.id && c.page === pageNo && nearby.includes(c.text.slice(0, 80))))
    .slice(0, 3)

  const chain = chainOf(tree, node.parentId)
  const chainText = chain
    .map((n, i) => {
      const q = trim(n.quote || n.anchor?.quote, 160)
      return \`\${i + 1}. 选中「\${q}」→ 问：\${trim(n.question, 160)}\\n   答：\${trim(n.answer, 500)}\`
    })
    .join('\\n')

  const titles = all.map((d) => \`《\${d.title}》\`).join('、')
  const system = multi
    ? \`你是「文档树」阅读助手。用户把 \${all.length} 份文档放进同一个组（\${titles}），它们共享一棵提问树，问题可能跨文档。
要求：
- 先给 1–2 句直接结论，再展开解释；引用原文时注明来自哪份文档、第几页。
- 跨文档时可以做对照，但只在用户问到的范围内，不要罗列整组内容。
- 如果用户是在追问上一条回答，先承接上文，再回答新问题。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\\\(...\\\\) 或 \\\\[...\\\\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记等），除非用户明确要求。\`
    : \`你是「文档树」阅读助手。用户在阅读《\${anchorDoc.title}》，通过划选文字向你提问。
要求：
- 先给 1–2 句直接结论，再展开解释；必要处引用原文，并标注页码。
- 解释要贴合这篇文档的语境，不要泛泛而谈教科书定义。
- 如果用户是在追问上一条回答，先承接上文，再回答新问题。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\\\(...\\\\) 或 \\\\[...\\\\] 的写法。
- 只解释这段文字本身：它在说什么、为什么这样说。
- 文档摘要和相关页只用来让你解释得准确，**不要在回答里复述**——不要写「在全文里的位置」「在全文中的作用」「与前后页的呼应」这类结构性小节，也不要按页罗列相关内容。确有必要提及其他页时，一句话带过。
- **不要生成应试辅助内容**：不写「记忆抓手」「记忆口诀」「背诵表」「考点速记」「失分点」这类东西，也不要自行编造考点。除非用户明确要求。\`

  const parts = []
  if (multi) {
    parts.push(
      \`【文档组（共 \${all.length} 份，共享提问树）】\\n\` +
        all.map((d) => \`《\${d.title}》\\n\${trim(d.summary || (d.pages?.[0]?.text || ''), 700)}\`).join('\\n\\n')
    )
  } else if (anchorDoc.summary) {
    parts.push(\`【文档摘要】\\n\${anchorDoc.summary}\`)
  } else {
    parts.push(\`【文档开头】\\n\${pageText.slice(0, 3000)}\`)
  }
  if (nearby) {
    const who = multi ? \`《\${anchorDoc.title}》\` : ''
    parts.push(\`【\${who}第 \${pageNo} 页\${quote ? '，选中处上下文' : '，本页内容'}】\\n\${nearby}\`)
  }
  if (related.length) {
    parts.push(
      \`【其他相关段落】\\n\` +
        related.map((c) => \`- \${multi ? \`《\${c.title}》\` : ''}第\${c.page}页 \${c.text}\`).join('\\n')
    )
  }
  if (chainText) parts.push(\`【本次追问所在的分支】\\n\${chainText}\`)

  const ask = [
    quote
      ? \`我在\${multi ? \`《\${anchorDoc.title}》\` : ''}（第 \${pageNo} 页）选中了：「\${quote}」\`
      : \`请讲解\${multi ? \`《\${anchorDoc.title}》\` : ''}第 \${pageNo} 页的整页内容。\`,
    \`我的问题：\${node.question || '请讲解这段内容'}\`
  ].join('\\n')

  const content = []
  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
  content.push({ type: 'text', text: parts.join('\\n\\n') + '\\n\\n' + ask })

  return [
    { role: 'system', content: system },
    { role: 'user', content: content.length === 1 ? content[0].text : content }
  ]
}

`
t = t.slice(0, start) + fn + t.slice(end)
fs.writeFileSync(F, t)
console.log('context rewritten')
