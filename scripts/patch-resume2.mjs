import fs from 'node:fs'
let s = fs.readFileSync('server.mjs', 'utf8')
const handler = fs.readFileSync('scripts/resume-handler.txt', 'utf8')

// stopped 标记
s = s.replace(
  "    } else if (ac.signal.aborted || (e && e.name === 'AbortError')) {\n      node.status = 'stopped'\n      sse({ type: 'stopped' })",
  "    } else if (ac.signal.aborted || (e && e.name === 'AbortError')) {\n      node.status = 'stopped'\n      node.stopped = true\n      sse({ type: 'stopped' })"
)
s = s.replace("    node.status = 'done'\n  } catch (e) {", "    node.status = 'done'\n    delete node.stopped\n  } catch (e) {")

if (!s.includes("'/api/ask/resume'")) {
  s = s.replace(
    "  if (p === '/api/ask' && req.method === 'POST') return handleAsk(req, res)",
    "  if (p === '/api/ask' && req.method === 'POST') return handleAsk(req, res)\n  if (p === '/api/ask/resume' && req.method === 'POST') return handleResume(req, res)"
  )
}
if (!s.includes('async function handleResume')) {
  s = s.replace('async function handleAsk(req, res) {', handler + 'async function handleAsk(req, res) {')
}
fs.writeFileSync('server.mjs', s)
console.log('resume inserted')
