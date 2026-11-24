import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    const last = Number(localStorage.getItem('dt:verCheckAt') || 0)\n    if (Date.now() - last < 86400000) return\n",
  ""
)
fs.writeFileSync(F, t)
console.log('throttle removed')
