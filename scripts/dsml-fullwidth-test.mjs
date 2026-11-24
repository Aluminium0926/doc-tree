import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const seen = []

// 全角版本，模拟截图里的 < ｜ ｜ DSML ｜ ｜
const fw = (s) => s.replace(/</g, '＜').replace(/>/g, '＞').replace(/\|/g, '｜').replace(/\//g, '／')
const dsml = fw('<|DSML|calls>\n<|DSML|invoke name="read_page">\n<|DSML|parameter name="page" string="false">10</|DSML|parameter>\n</|DSML|invoke>\n</|DSML|calls>')
const chunks = [dsml.slice(0, 18), dsml.slice(18, 55), dsml.slice(55)]

const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const j = JSON.parse(body || '{}')
    seen.push(j)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const hasTool = (j.messages || []).some((m) => m.role === 'tool')
    if (!hasTool) {
      for (const c of chunks) res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: c } }] }) + '\n\n')
      res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
    } else {
      res.write('data: {"choices":[{"delta":{"content":"全角标记已识别"}}]}\n\n')
    }
    res.end('data: [DONE]\n\n')
  })
})
await new Promise((r) => srv.listen(4411, '127.0.0.1', r))

const post = (p, b) => fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

try {
  await post('/api/config', { baseUrl: 'http://127.0.0.1:4411/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' })
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const doc = st.docs.find((d) => d.kind === 'pdf' && d.pages >= 10)
  const before = await (await fetch('http://127.0.0.1:4317/api/doc/' + doc.id)).json()
  const beforeIds = new Set(Object.keys(before.tree.nodes))
  const res = await (await post('/api/ask', { docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '讲第10页' })).text()
  const toolReq = seen.find((x) => (x.messages || []).some((m) => m.role === 'tool'))
  const toolMsg = toolReq ? toolReq.messages.find((m) => m.role === 'tool').content : ''
  const after = await (await fetch('http://127.0.0.1:4317/api/doc/' + doc.id)).json()
  const fresh = Object.values(after.tree.nodes).filter((n) => !beforeIds.has(n.id))
  const last = fresh[fresh.length - 1] || {}
  console.log(JSON.stringify({
    sseHasDSML: /DSML/.test(res),
    rounds: seen.length,
    toolCalled: !!toolReq,
    toolHasPage10: String(toolMsg).includes('第 10 页'),
    answer: (last.answer || '').trim().slice(0, 20)
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  srv.close()
}
