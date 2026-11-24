import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("  S.docs = r.docs || []", "  S.docs = r.docs || []\n  S.groups = r.groups || []")
fs.writeFileSync(F, t)
console.log(t.includes('S.groups = r.groups') ? 'ok' : 'not matched')
