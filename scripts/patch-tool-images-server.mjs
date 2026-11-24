import fs from 'node:fs'
let s = fs.readFileSync('server.mjs', 'utf8')
if (!s.includes('async function execWithPageImages')) {
  s = s.replace(
    'async function handleAsk(req, res) {',
    `async function execWithPageImages(docs, docId, name, args) {
  const out = await execTool(docs, docId, name, args)
  if (name === 'read_page' && args && args.page) {
    let target = docs.find((d) => d.id === docId) || docs[0]
    if (args.doc) {
      const q = String(args.doc).toLowerCase()
      target = docs.find((d) => (d.title || '').toLowerCase().includes(q)) || target
    }
    if (target && target.kind === 'pdf') {
      const img = await renderPageImage(target, Number(args.page)).catch(() => null)
      if (img) return { text: out, image: img }
    }
  }
  return out
}

async function handleAsk(req, res) {`
  )
}
s = s.split('exec: (name, args) => execTool(docs, doc.id, name, args)').join('exec: (name, args) => execWithPageImages(docs, doc.id, name, args)')
fs.writeFileSync('server.mjs', s)

// 工具描述补充
let c = fs.readFileSync('lib/context.mjs', 'utf8')
c = c.replace(
  "description: '读取某一页的原文。页码从 1 开始；doc 可选，用文档标题关键词指定组内文档。'",
  "description: '读取某一页的原文；如果是 PDF，还会附带该页截图，可识别图表、公式和文字层遗漏的内容。页码从 1 开始；doc 可选，用文档标题关键词指定组内文档。'"
)
fs.writeFileSync('lib/context.mjs', c)
console.log('server tool images ok')
