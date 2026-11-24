import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
if(!a.includes("$('#page-scroll')?.addEventListener('scroll', scheduleViewSave")){
  a=a.replace("window.addEventListener('beforeunload', () => saveViewState())", `window.addEventListener('beforeunload', () => saveViewState())
$('#page-scroll')?.addEventListener('scroll', scheduleViewSave, { passive: true })
$('#tree')?.addEventListener('scroll', scheduleViewSave, { passive: true })`)
  fs.writeFileSync('public/app.js',a)
}
console.log('scroll listeners attached', a.includes("scheduleViewSave, { passive: true }"))
