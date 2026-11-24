import fs from 'node:fs'
let e=fs.readFileSync('lib/extract.mjs','utf8')
e=e.replace(
`export function kindOf(ext) {
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx' || ext === '.doc') return 'docx'
  if (ext === '.md' || ext === '.markdown') return 'md'
  return 'text'
}`,
`export const SUPPORTED_EXT = new Set(['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx'])

export function kindOf(ext) {
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx' || ext === '.doc') return 'docx'
  if (ext === '.md' || ext === '.markdown') return 'md'
  if (ext === '.pptx') return 'pptx'
  return 'text'
}`
)
e=e.replace(
`  if (kind === 'pdf') return { kind, pages: await extractPdf(buf) }
  if (kind === 'docx') return { kind, pages: await extractDocx(buf) }`,
`  if (kind === 'pdf') return { kind, pages: await extractPdf(buf) }
  if (kind === 'docx') return { kind, pages: await extractDocx(buf) }
  if (kind === 'pptx') return { kind, pages: await extractPptx(buf) }`
)
if(!e.includes('async function extractPptx')){
  e=e.replace('function decodeText(buf) {', `function decodeXml(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function extractPptx(buf) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(Buffer.from(buf))
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\\/slides\\/slide\\d+\\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\\d+)\\.xml$/)[1]) - Number(b.match(/(\\d+)\\.xml$/)[1]))
  if (!slides.length) throw new Error('这个 PPTX 里没有找到幻灯片')
  const out = []
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.file(slides[i]).async('string')
    const texts = [...xml.matchAll(/<a:t[^>]*>([\\s\\S]*?)<\\/a:t>/g)].map((m) => decodeXml(m[1]))
    const body = texts.join('\\n').trim()
    out.push(\`## 第 \${i + 1} 页\\n\\n\${body || '（本页没有文字）'}\`)
  }
  return [{ no: 1, text: clean(out.join('\\n\\n---\\n\\n')) }]
}

function decodeText(buf) {`)
}
fs.writeFileSync('lib/extract.mjs',e)
console.log('server pptx extract ok')
