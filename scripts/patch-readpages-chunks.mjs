import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')

// read_pages 工具
t = t.replace(
  `  {
    name: 'search_docs',`,
  `  {
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
    name: 'search_docs',`
)

t = t.replace(
  `  if (name === 'search_docs') {`,
  `  if (name === 'read_pages') {
    const d = pickDoc(docs, args.doc, defaultDocId)
    const from = Math.max(1, Number(args.from) || 1)
    const to = Math.min(Number(args.to) || from, from + 2)
    const pages = (d.pages || []).filter((p) => p.no >= from && p.no <= to)
    if (!pages.length) return \`《\${d.title}》没有第 \${from}–\${to} 页（共 \${(d.pages || []).length} 页）\`
    let out = ''
    for (const p of pages) {
      if (!(p.text || '').trim()) continue
      if (out.length + p.text.length > 9000) break
      out += \`[第\${p.no}页]\\n\${p.text.slice(0, 3500)}\\n\\n\`
    }
    return out.trim() ? \`《\${d.title}》第 \${from}–\${to} 页：\\n\${out.trim()}\` : \`第 \${from}–\${to} 页没有文字层\`
  }
  if (name === 'search_docs') {`
)

// 句子/段落级切块
t = t.replace(
  `export function splitChunks(doc, size = 700) {
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
}`,
  `export function splitChunks(doc, size = 700) {
  const chunks = []
  for (const p of doc.pages || []) {
    const text = p.text || ''
    if (!text.trim()) continue
    // 优先按段落/句子边界切，避免把一句话切成两半
    const parts = text.split(/(?<=[。！？!?；;])\\s+|\\n{2,}/).filter((s) => s && s.trim())
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
      buf += (buf ? '\\n' : '') + part
    }
    flush()
  }
  return chunks
}`
)
fs.writeFileSync(F, t)
console.log('read_pages + sentence chunking ok')
