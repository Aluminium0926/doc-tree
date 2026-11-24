import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("#toast {\n  position: absolute;", "#toast {\n  position: fixed;\n  z-index: 150;")
fs.writeFileSync(F, t)
console.log('toast z-index fixed')
