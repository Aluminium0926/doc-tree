import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("  const apply = () => {\n    if (!S.doc || S.doc.id !== docId) return", "  const apply = () => {\n    if (!S.doc || S.doc.id !== docId) return\n    console.log('[view] apply', docId, v.scrollTop, (document.querySelector('#page-scroll')||{}).scrollTop)")
a=a.replace("  viewRestoring = true", "  viewRestoring = true\n  console.log('[view] restore start', docId, v.scrollTop, v.page)")
a=a.replace("  viewRestoring = false\n    saveViewState(docId)", "  viewRestoring = false\n    console.log('[view] save after restore', docId, (document.querySelector('#page-scroll')||{}).scrollTop)\n    saveViewState(docId)")
a=a.replace("async function refitPdf() {", "async function refitPdf() {\n  console.log('[view] refitPdf', (document.querySelector('#page-scroll')||{}).scrollTop)")
a=a.replace("async function relayoutPages() {", "async function relayoutPages() {\n  console.log('[view] relayout start', (document.querySelector('#page-scroll')||{}).scrollTop)")
fs.writeFileSync('public/app.js',a)
console.log('debug logs added')
