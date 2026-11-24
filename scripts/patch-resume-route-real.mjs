import fs from 'node:fs'
const F = 'server.mjs'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes("'/api/ask/resume'")) {
  t = t.replace(
    "  if (p === '/api/ask' && req.method === 'POST') {",
    "  if (p === '/api/ask/resume' && req.method === 'POST') return handleResume(req, res)\n\n  if (p === '/api/ask' && req.method === 'POST') {"
  )
  fs.writeFileSync(F, t)
}
console.log(t.includes("'/api/ask/resume'") ? 'route added' : 'failed')
