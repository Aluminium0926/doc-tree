import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  '#shot-chip { max-width: 100%; min-width: 0; }',
  '#shot-chip { width: fit-content; max-width: 100%; min-width: 0; }'
)
fs.writeFileSync(F, t)
console.log('shot chip shrink-to-fit ok')
