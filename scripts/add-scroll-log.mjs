import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("$('#page-scroll')?.addEventListener('scroll', scheduleViewSave, { passive: true })", "$('#page-scroll')?.addEventListener('scroll', () => console.log('[view] SCROLL', document.querySelector('#page-scroll').scrollTop, 't', performance.now().toFixed(0)), { passive: true })\n$('#page-scroll')?.addEventListener('scroll', scheduleViewSave, { passive: true })")
fs.writeFileSync('public/app.js',a)
