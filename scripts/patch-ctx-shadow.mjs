import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.55);\n  backdrop-filter: blur(10px);\n}\n.ctx-menu button {",
  "  box-shadow: 0 0 12px rgba(0, 0, 0, 0.20), 0 0 3px rgba(0, 0, 0, 0.12);\n  backdrop-filter: blur(10px);\n}\n.ctx-menu button {"
)
fs.writeFileSync(F, t)
console.log(t.includes('0 0 12px rgba(0, 0, 0, 0.20)') ? 'ok' : 'not matched')
