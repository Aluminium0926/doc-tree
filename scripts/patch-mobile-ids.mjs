import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("    const add = Array.isArray(body.add) ? body.add : []", "    const add = Array.isArray(body.add) ? body.add.filter(Boolean) : []")
t = t.replace("    const remove = Array.isArray(body.remove) ? body.remove : []", "    const remove = Array.isArray(body.remove) ? body.remove.filter(Boolean) : []")
fs.writeFileSync(F, t)
console.log('mobile ids filtered')
