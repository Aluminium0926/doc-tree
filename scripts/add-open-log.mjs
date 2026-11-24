import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("async function openDoc(id) {\n  if (S.doc) saveViewState(S.doc.id)", "async function openDoc(id) {\n  console.log('[view] OPEN', id, 'from', S.doc?.id)\n  if (S.doc) saveViewState(S.doc.id)")
a=a.replace("  updateToolbar()\n  restoreViewState(id)\n}", "  updateToolbar()\n  console.log('[view] OPEN DONE', id)\n  restoreViewState(id)\n}")
a=a.replace("console.log('[view] SCROLL', document.querySelector('#page-scroll').scrollTop, 't', performance.now().toFixed(0))", "console.log('[view] SCROLL', document.querySelector('#page-scroll').scrollTop, 'current', S.doc?.id, 't', performance.now().toFixed(0))")
fs.writeFileSync('public/app.js',a)
