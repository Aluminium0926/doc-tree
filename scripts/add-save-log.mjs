import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("function saveViewState(docId = S.doc?.id) {\n  if (!docId) return", "function saveViewState(docId = S.doc?.id) {\n  if (!docId) return\n  console.log('[view] save', docId, (document.querySelector('#page-scroll')||{}).scrollTop, 'current', S.doc?.id)")
fs.writeFileSync('public/app.js',a)
console.log('save log added')
