import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(`    q.focus({ preventScroll: true })
    if (end) {
      const n = q.value.length
      q.setSelectionRange(n, n)
    }
    return document.activeElement === q`, `    q.focus({ preventScroll: true })
    if (end) {
      // 强制重绘光标；某些 Chromium 状态下 focus 成功但光标不闪
      try {
        if (document.activeElement === q) {
          q.blur()
          q.focus({ preventScroll: true })
        }
        const n = q.value.length
        q.setSelectionRange(n, n)
      } catch {}
    }
    return document.activeElement === q`)
if(!a.includes('focus heartbeat')){
  a += `
// focus heartbeat: if nobody owns focus, keep returning it to the composer
setInterval(() => {
  if (!document.hasFocus()) return
  if (document.querySelector('.modal:not([hidden])')) return
  const ae = document.activeElement
  if (ae && ae !== document.body && ae.tagName !== 'HTML') return
  focusComposer()
}, 1500)
`
  fs.writeFileSync('public/app.js',a)
}
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.43';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
a=fs.readFileSync('public/app.js','utf8')
a=a.replace("const UI_VERSION = 'v148'","const UI_VERSION = 'v149'").replace("const APP_VERSION = '1.0.42'","const APP_VERSION = '1.0.43'").replace("chem.js?v=1.0.42", "chem.js?v=1.0.43")
fs.writeFileSync('public/app.js',a)
console.log('heartbeat/repaint', a.includes('focus heartbeat'), a.includes('q.blur()'))
