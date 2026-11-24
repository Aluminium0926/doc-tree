import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    if (!g) return json({ group: null, dissolved: true })\n    const tree = await db.getTree('group:' + g.id)",
  "    if (!g) return json({ group: null, dissolved: true })\n    if (typeof body.name === 'string' && body.name.trim()) g.name = body.name.trim()\n    const tree = await db.getTree('group:' + g.id)"
)
fs.writeFileSync(F, t)
console.log('mobile rename ok')
