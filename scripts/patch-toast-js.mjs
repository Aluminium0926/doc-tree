import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `function toast(msg) {
  const t = $('#toast')
  t.textContent = msg`,
  `function toast(msg, kind = 'ok') {
  const t = $('#toast')
  t.classList.toggle('err', kind === 'error')
  t.textContent = msg`
)
fs.writeFileSync(F, t)
console.log('toast kind supported')
