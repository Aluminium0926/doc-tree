import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%);",
  "  position: fixed; left: 50%; top: 12px; transform: translateX(-50%);"
)
fs.writeFileSync(F, t)
console.log(t.includes('top: 12px') ? 'css moved' : 'not matched')
