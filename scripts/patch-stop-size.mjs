import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace('.stop-btn svg { display: block; width: 10px; height: 10px; }', '.stop-btn svg { display: block; width: 14px; height: 14px; }')
fs.writeFileSync(F, t)
console.log('stop icon bigger')
