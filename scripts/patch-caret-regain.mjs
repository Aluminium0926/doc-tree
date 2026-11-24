import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
`  const q = document.querySelector('#q')
  const ae = document.activeElement
  if (!q || ae === q) return
  if (ae && ae !== document.body && ae.tagName !== 'HTML') return
  try { q.focus({ preventScroll: true }) } catch {}`,
`  const q = document.querySelector('#q')
  const ae = document.activeElement
  if (!q) return
  if (ae && ae !== q && ae !== document.body && ae.tagName !== 'HTML') return
  try { q.focus({ preventScroll: true }) } catch {}`
)
fs.writeFileSync('public/app.js',a)
console.log('autofocus regains caret', a.includes("ae !== q"))
