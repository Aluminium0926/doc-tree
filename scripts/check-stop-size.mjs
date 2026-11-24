import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
console.log(t.includes('width: 14px; height: 14px') ? 'css ok' : 'missing')
