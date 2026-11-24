import fs from 'node:fs'
let e=fs.readFileSync('lib/extract.mjs','utf8')
e=e.replace(
"export const SUPPORTED_EXT = new Set(['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx', '.ppt'])",
"export const SUPPORTED_EXT = new Set(['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])"
)
e=e.replace(
"  if (ext === '.pptx') return 'pptx'\n  return 'text'",
"  if (ext === '.pptx') return 'pptx'\n  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) return 'image'\n  return 'text'"
)
e=e.replace(
"  if (kind === 'pptx') return { kind, pages: await extractPptx(buf) }",
"  if (kind === 'pptx') return { kind, pages: await extractPptx(buf) }\n  if (kind === 'image') return { kind, pages: await extractImage(buf) }"
)
if(!e.includes('async function extractImage')){
  e += `\nasync function extractImage(buf) {\n  const { loadImage } = await import('@napi-rs/canvas')\n  const img = await loadImage(Buffer.from(buf))\n  return [{ no: 1, text: '', w: img.width, h: img.height }]\n}\n`
}
fs.writeFileSync('lib/extract.mjs',e)

let r=fs.readFileSync('lib/render.mjs','utf8')
r=r.replace("import path from 'node:path'", "import path from 'node:path'\nimport fsp from 'node:fs/promises'")
if(!r.includes('IMAGE_MIME')){
  r=r.replace("export async function renderPageImage(doc, pageNo) {", `const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }

export async function renderPageImage(doc, pageNo) {
  if (doc && doc.kind === 'image') {
    const mime = IMAGE_MIME[doc.ext] || 'image/png'
    const buf = await fsp.readFile(store.filePath(doc.id, doc.ext))
    return 'data:' + mime + ';base64,' + buf.toString('base64')
  }`)
}
r=r.replace("  if (!doc || doc.kind !== 'pdf') return null\n", "  if (!doc || doc.kind !== 'pdf') return null\n")
fs.writeFileSync('lib/render.mjs',r)
console.log('extract/render image ok')
