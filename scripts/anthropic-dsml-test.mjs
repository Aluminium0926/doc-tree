import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const seen = []
const dsml = '<|DSML|calls>\n<|DSML|invoke name="read_page">\n<|DSML|parameter name="page">62</|DSML|parameter>\n</|DSML|invoke>\n</|DSML|calls>'
const p1 = dsml.slice(0, 50)
const p2 = dsml.slice(50)

const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const j = JSON.parse(body || '{}')
    seen.push(j)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const hasTool = JSON.stringify(j.messages || '').includes('tool_result')
    const send = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n')
    if (!hasTool) {
      send({ type: 'content_block_start', index: 0, content_block: { type: 'text' } })
      send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p1 } })
      send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p2 } })
      send({ type: 'message_stop' })
    } else {
      send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Anthropic 读到第62页' } })
      send({ type: 'message_stop' })
    }
    res.end()
  })
})
await new Promise((r) => srv.listen(4410, '127.0.0.1', r))

const post = (p, b) => fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

try {
  await post('/api/config', { baseUrl: 'http://127.0.0.1:4410/v1', apiKey: 'k', model: 'm', apiFormat: 'anthropic' })
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const doc = st.docs.find((d) => d.kind === 'pdf' && d.pages >= 62)
  const before = await (await fetch('http://127.0.0.1:4317/api/doc/' + doc.id)).json()
  const beforeIds = new Set(Object.keys(before.tree.nodes))
  const res = await (await post('/api/ask', { docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '讲第62页' })).text()
  const toolReq = seen.find((x) => JSON.stringify(x.messages || '').includes('tool_result'))
  const toolText = toolReq ? JSON.stringify(toolReq.messages) : ''
  const node = await (await fetch('http://127.0.0.1:4317/api/doc/' + doc.id)).json()
  const fresh = Object.values(node.tree.nodes).filter((n) => !beforeIds.has(n.id))
  const last = fresh[fresh.length - 1] || {}
  console.log(JSON.stringify({
    sseHasDSML: res.includes('DSML'),
    rounds: seen.length,
    toolResultHasPage62: toolText.includes('第 62 页'),
    answer: (last.answer || '').trim().slice(0, 30)
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  srv.close()
}
