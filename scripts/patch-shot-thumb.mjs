import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace('#shot-chip img { max-height: 64px; border-radius: 7px; border: 1px solid var(--line); }', '#shot-chip img { max-height: 64px; }')
fs.writeFileSync(F, t)
console.log('shot thumb css ok')
