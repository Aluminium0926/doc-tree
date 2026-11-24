import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("  console.log('[view] save', docId, (document.querySelector('#page-scroll')||{}).scrollTop, 'current', S.doc?.id)", "  console.log('[view] save', docId, (document.querySelector('#page-scroll')||{}).scrollTop, 'current', S.doc?.id)\n  if ((document.querySelector('#page-scroll')||{}).scrollTop === 0) console.log('[view] ZERO', new Error().stack)")
fs.writeFileSync('public/app.js',a)
