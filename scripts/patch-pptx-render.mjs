import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("  if (S.doc.kind === 'md') {\n    sheet.innerHTML = renderMarkdown(text)", "  if (S.doc.kind === 'md' || S.doc.kind === 'pptx') {\n    sheet.innerHTML = renderMarkdown(text)")
fs.writeFileSync('public/app.js',a)
console.log('pptx render markdown ok')
