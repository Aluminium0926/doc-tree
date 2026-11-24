import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    const groups = readGroups()\n    const docs =",
  "    const groups = readGroups()\n    const flags = (() => { try { return JSON.parse(localStorage.getItem('dt:flags') || '{}') } catch { return {} } })()\n    const docs ="
)
t = t.replace("return json({ docs, groups, config: publicConfig() })", "return json({ docs, groups, flags, config: publicConfig() })")
if (!t.includes("'/api/flags'")) {
  t = t.replace(
    "  if (p === '/api/group' && method === 'POST') {",
    `  if (p === '/api/flags' && method === 'POST') {
    const body = await bodyJson(init)
    let flags = {}
    try {
      flags = JSON.parse(localStorage.getItem('dt:flags') || '{}')
    } catch {}
    for (const k of ['welcomeSeen', 'guideSeen']) if (typeof body[k] === 'boolean') flags[k] = body[k]
    localStorage.setItem('dt:flags', JSON.stringify(flags))
    return json({ flags })
  }

  if (p === '/api/group' && method === 'POST') {`
  )
}
fs.writeFileSync(F, t)
console.log('mobile flags ok')
