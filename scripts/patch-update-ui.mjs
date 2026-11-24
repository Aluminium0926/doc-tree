import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const noAsk = $('#cfg-ask-remove')",
  "  const upChk = $('#cfg-update-check')\n  if (upChk) upChk.checked = localStorage.getItem('dt:verCheckOff') !== '1'\n  const noAsk = $('#cfg-ask-remove')"
)
t = t.replace(
  "  $('#cfg-ask-remove')?.addEventListener('change', (e) => {",
  "  $('#cfg-update-check')?.addEventListener('change', (e) => {\n    if (e.target.checked) localStorage.removeItem('dt:verCheckOff')\n    else localStorage.setItem('dt:verCheckOff', '1')\n  })\n\n  $('#cfg-ask-remove')?.addEventListener('change', (e) => {"
)
fs.writeFileSync(F, t)
console.log('ui wired')
