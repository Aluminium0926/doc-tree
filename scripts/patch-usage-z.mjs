import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('#usage {')) {
  t += `

#usage { z-index: 95; }
`
  fs.writeFileSync(F, t)
}
console.log('usage z-index ok')
