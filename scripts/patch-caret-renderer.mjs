import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
if(!a.includes('function autoFocusComposer')){
  a += `
function autoFocusComposer() {
  if (window.DT_LOCAL) return
  if (document.querySelector('.modal:not([hidden])')) return
  const q = document.querySelector('#q')
  const ae = document.activeElement
  if (!q || ae === q) return
  if (ae && ae !== document.body && ae.tagName !== 'HTML') return
  try { q.focus({ preventScroll: true }) } catch {}
}
window.addEventListener('focus', () => setTimeout(autoFocusComposer, 60))
setTimeout(autoFocusComposer, 500)
setTimeout(autoFocusComposer, 1600)
`
  fs.writeFileSync('public/app.js',a)
}
console.log('renderer autofocus added')
