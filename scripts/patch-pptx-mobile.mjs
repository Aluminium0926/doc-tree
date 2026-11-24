import fs from 'node:fs'
let e=fs.readFileSync('mobile/src/extract.js','utf8')
if(!e.includes('extractPptx')){
  e=e.replace(
    'async function extractDocx(buf) {',
    `async function extractPptx(buf) {
  if (!window.JSZip) await loadScript(VENDOR + 'jszip.min.js')
  const zip = await window.JSZip.loadAsync(buf)
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\\/slides\\/slide\\d+\\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\\d+)\\.xml$/)[1]) - Number(b.match(/(\\d+)\\.xml$/)[1]))
  if (!slides.length) throw new Error('这个 PPTX 里没有找到幻灯片')
  const decode = (s) => String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const out = []
  for (let i = 0; i < slides.length; i++) {
    const xml = await zip.file(slides[i]).async('string')
    const texts = [...xml.matchAll(/<a:t[^>]*>([\\s\\S]*?)<\\/a:t>/g)].map((m) => decode(m[1]))
    out.push(\`## 第 \${i + 1} 页\\n\\n\${texts.join('\\n').trim() || '（本页没有文字）'}\`)
  }
  return { kind: 'pptx', pages: [{ no: 1, text: normalize(out.join('\\n\\n---\\n\\n')) }] }
}

async function extractDocx(buf) {`
  )
  e=e.replace(
    "  if (e === '.docx') return extractDocx(buf)",
    "  if (e === '.docx') return extractDocx(buf)\n  if (e === '.pptx') return extractPptx(buf)"
  )
  fs.writeFileSync('mobile/src/extract.js',e)
}

let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes('jszip.min.js')){
  b=b.replace(
    "copy(path.join(root, 'node_modules', 'mammoth', 'mammoth.browser.min.js'), path.join(out, 'vendor', 'mammoth.browser.min.js'))",
    "copy(path.join(root, 'node_modules', 'mammoth', 'mammoth.browser.min.js'), path.join(out, 'vendor', 'mammoth.browser.min.js'))\ncopy(path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js'), path.join(out, 'vendor', 'jszip.min.js'))"
  )
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('mobile pptx ok')
