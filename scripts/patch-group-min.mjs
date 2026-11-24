import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const btn = $('#group-create')\n  if (btn) btn.disabled = n < 2",
  "  const btn = $('#group-create')\n  if (btn) btn.disabled = n < (S.groupTarget ? 1 : 2)"
)
fs.writeFileSync(F, t)
console.log(t.includes("n < (S.groupTarget ? 1 : 2)") ? 'min fixed' : 'not matched')
