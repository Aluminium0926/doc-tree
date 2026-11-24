import fs from 'node:fs'

const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')

// ---------- 1) 工具定义与执行 ----------
if (!t.includes('export const TOOL_SPECS')) {
  const tools = `
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
    return docs.map((d) => \`《\${d.title}》（\${(d.pages || []).length} 页）\`).join('\\n')
  }
  if (name === 'read_page') {
    const d = pickDoc(docs, args.doc, defaultDocId)
    const page = Number(args.page)
    const p = (d.pages || []).find((x) => x.no === page)
    if (!p || !(p.text || '').trim()) {
      return \`《\${d.title}》第 \${page} 页没有文字层（可能是扫描件），共 \${(d.pages || []).length} 页。\`
    }
    return \`《\${d.title}》第 \${page} 页：\\n\${p.text.slice(0, 5000)}\`
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
    if (!hits.length) return \`没有检索到与「\${query}」相关的内容\`
    return hits
      .map((c) => \`《\${c.title}》第\${c.page}页：\\n\${c.text.slice(0, 900)}\`)
      .join('\\n\\n---\\n\\n')
  }
  return \`未知工具：\${name}\`
}
`
  t = t.replace('export function buildAskMessages', tools + '\nexport function buildAskMessages')
}

// ---------- 2) 用工具说明替换“硬塞全文”的上下文 ----------
const start = t.indexOf('  // 用户问题里提到的页码')
const end = t.indexOf('  const ask = [')
if (start < 0 || end < 0) throw new Error('parts markers missing')

const block = `  const parts = []
  if (multi) {
    parts.push(
      \`【文档组（共 \${all.length} 份，共享提问树）】\\n\` +
        all.map((d) => \`《\${d.title}》（\${(d.pages || []).length} 页）\`).join('\\n')
    )
    const sums = all
      .filter((d) => d.summary)
      .map((d) => \`《\${d.title}》：\${trim(d.summary, 500)}\`)
      .join('\\n')
    if (sums) parts.push(\`【组内文档摘要】\\n\${sums}\`)
  } else if (anchorDoc.summary) {
    parts.push(\`【文档摘要】\\n\${anchorDoc.summary}\`)
  } else {
    parts.push(\`【文档开头】\\n\${trim(pageText, 1200)}\`)
  }

  if (nearby) {
    const who = multi ? \`《\${anchorDoc.title}》\` : ''
    parts.push(\`【\${who}第 \${pageNo} 页\${quote ? '，选中处上下文' : '，本页内容'}】\\n\${nearby}\`)
  }
  if (related.length) {
    parts.push(
      \`【其他相关段落】\\n\` +
        related.map((c) => \`- \${multi ? \`《\${c.title}》\` : ''}第\${c.page}页 \${trim(c.text, 700)}\`).join('\\n')
    )
  }
  if (chainText) parts.push(\`【本次追问所在的分支】\\n\${chainText}\`)

`
t = t.slice(0, start) + block + t.slice(end)

// 系统提示：告诉模型优先用工具取原文
t = t.replace(
  '- **不要生成应试辅助内容**',
  `- 你可以调用工具读取原文：read_page(page, doc?) 读任意页、search_docs(query, doc?) 检索、list_docs() 看组内文档。
- 需要某页原文、或不确定内容在哪时，**先调用工具再回答**，不要凭摘要猜，也不要声称拿不到某页——先 read_page。
- 已经在上文给出的内容不必重复读取。
- **不要生成应试辅助内容**`
)

fs.writeFileSync(F, t)
console.log('tools + lean context ok')
