import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace('  opacity: 0; transition: opacity .12s;', '  opacity: 0.55; transition: opacity .12s;')
fs.writeFileSync(F, t)
console.log('ungroup visible')
