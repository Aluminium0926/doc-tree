import fs from 'node:fs'
const F='public/style.css'
let t=fs.readFileSync(F,'utf8')
t=t.replace(
  ".shot-mode .page { cursor: crosshair; }",
  ".shot-mode .page { cursor: crosshair; touch-action: none; user-select: none; }"
)
fs.writeFileSync(F,t)
console.log('shot touch-action ok')
