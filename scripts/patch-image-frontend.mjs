import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.replace("  '.png': 'image/png',\n  '.jpg': 'image/jpeg',", "  '.png': 'image/png',\n  '.jpg': 'image/jpeg',\n  '.jpeg': 'image/jpeg',\n  '.webp': 'image/webp',\n  '.gif': 'image/gif',\n  '.bmp': 'image/bmp',")
s=s.replace("        'content-type': doc.ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',", "        'content-type': MIME[doc.ext] || (doc.ext === '.pdf' ? 'application/pdf' : 'application/octet-stream'),")
fs.writeFileSync('server.mjs',s)

let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
  "if (!/\\.(pdf|docx?|md|markdown|txt|pptx?)$/.test(ext)) {\n      toast(`暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPT / PPTX`)",
  "if (!/\\.(pdf|docx?|md|markdown|txt|pptx?|png|jpe?g|webp|gif|bmp)$/.test(ext)) {\n      toast(`暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPT / PPTX / 图片`)"
)
a=a.replace(
  "  if (S.doc.kind === 'pdf') await renderPdf()\n  else renderTextDoc()",
  "  if (S.doc.kind === 'pdf') await renderPdf()\n  else if (S.doc.kind === 'image') await renderImageDoc()\n  else renderTextDoc()"
)
if(!a.includes('function renderImageDoc')){
  a=a.replace("function renderTextDoc() {", `async function renderImageDoc() {
  const src = window.DT_LOCAL ? await window.DTLocal.fileUrl(S.doc.id) : \`/api/file/\${S.doc.id}\`
  const page = document.createElement('div')
  page.className = 'page image-page'
  page.dataset.page = '1'
  const img = document.createElement('img')
  img.src = src
  img.alt = S.doc.title || '图片'
  img.draggable = false
  page.appendChild(img)
  $('#pages').appendChild(page)
}

function renderTextDoc() {`)
}
a=a.replace(
  "  const base =\n    S.doc.kind === 'pdf'\n      ? `${S.doc.pages.length} 页 · PDF`\n      : `${(S.doc.kind || '').toUpperCase()} · ${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字`",
  "  const base =\n    S.doc.kind === 'pdf'\n      ? `${S.doc.pages.length} 页 · PDF`\n      : S.doc.kind === 'image'\n        ? '图片 · 1 张'\n        : `${(S.doc.kind || '').toUpperCase()} · ${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字`"
)
if(!a.includes("addEventListener('paste'")){
  a=a.replace(
    "  $('#btn-web')?.addEventListener('click', () => setWebSearch(!S.webSearch))",
    `  $('#btn-web')?.addEventListener('click', () => setWebSearch(!S.webSearch))

  document.addEventListener('paste', (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/'))
    if (!items.length) return
    e.preventDefault()
    const files = items
      .map((i) => i.getAsFile())
      .filter(Boolean)
      .map((f, i) => {
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\\..+/, '').replace('T', '-')
        const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
        return new File([f], \`剪贴板-\${stamp}\${i ? '-' + i : ''}.\${ext}\`, { type: f.type })
      })
    if (files.length) {
      toast(\`从剪贴板导入 \${files.length} 张图片\`)
      importFiles(files)
    }
  })`
  )
}
fs.writeFileSync('public/app.js',a)

let h=fs.readFileSync('public/index.html','utf8')
h=h.replace('accept=".pdf,.docx,.md,.markdown,.txt,.ppt,.pptx"','accept=".pdf,.docx,.md,.markdown,.txt,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.bmp"')
fs.writeFileSync('public/index.html',h)

let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('.image-page')){
  c += `
.image-page { display: flex; justify-content: center; align-items: flex-start; padding: 18px; background: var(--panel-2); }
.image-page img { max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,.18); user-select: none; -webkit-user-drag: none; }
`
  fs.writeFileSync('public/style.css',c)
}
console.log('frontend image import ok')
