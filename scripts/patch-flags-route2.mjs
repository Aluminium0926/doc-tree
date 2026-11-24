import fs from 'node:fs'
const F = 'server.mjs'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes("'/api/flags'")) {
  const anchor = "if (p === '/api/group' && req.method === 'POST') {"
  const route = `if (p === '/api/flags' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const patch = {}
    for (const k of ['welcomeSeen', 'guideSeen']) if (typeof body[k] === 'boolean') patch[k] = body[k]
    const flags = await store.setFlags(patch)
    return json(res, 200, { flags })
  }

  `
  t = t.replace(anchor, route + anchor)
  fs.writeFileSync(F, t)
}
console.log(t.includes("'/api/flags'") ? 'route ok' : 'failed')
