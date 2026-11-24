import fs from 'node:fs'
let e=fs.readFileSync('mobile/src/extract.js','utf8')
e=e.replace(
  "  if (e === '.pptx') return extractPptx(buf)",
  "  if (e === '.pptx') return extractPptx(buf)\n  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(e)) return extractImage(buf)"
)
if(!e.includes('async function extractImage')){
  e=e.replace(
    "export async function extract(buf, ext) {",
    `async function extractImage(buf) {
  const blob = new Blob([buf])
  let w = 0
  let h = 0
  try {
    const bmp = await createImageBitmap(blob)
    w = bmp.width
    h = bmp.height
    bmp.close?.()
  } catch {}
  return { kind: 'image', pages: [{ no: 1, text: '', w, h }] }
}

export async function extract(buf, ext) {`
  )
}
fs.writeFileSync('mobile/src/extract.js',e)

let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(
  "if (!['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx'].includes(ext)) {\n      return json({ error: `暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX` }, 415)",
  "if (!['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {\n      return json({ error: `暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX / 图片` }, 415)"
)
a=a.replace(
  "    if (!pageImage && doc.kind === 'pdf') {",
  "    if (!pageImage && (doc.kind === 'pdf' || doc.kind === 'image')) {"
)
a=a.replace(
  "      pageImage = await globalThis.__dtPageImage?.(body.anchor?.page || 1)",
  "      pageImage = doc.kind === 'image' ? await imageDocDataUrl(doc) : await globalThis.__dtPageImage?.(body.anchor?.page || 1)"
)
a=a.replace(
  "  if (doc.kind === 'pdf') {\n    try {",
  "  if (doc.kind === 'pdf' || doc.kind === 'image') {\n    try {"
)
if(!a.includes('async function imageDocDataUrl')){
  a=a.replace(
    "async function execWithPageImage(docs, docId, name, args) {",
    `async function imageDocDataUrl(doc) {
  try {
    const f = await db.getFile(doc.id)
    if (!f?.blob) return null
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => resolve(null)
      r.readAsDataURL(f.blob)
    })
  } catch {
    return null
  }
}

async function execWithPageImage(docs, docId, name, args) {`
  )
}
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile image support ok')
