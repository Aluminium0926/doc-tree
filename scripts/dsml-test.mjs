import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const seen = []

const dsml = '<|DSML|calls>\n<|DSML|invoke name="read_page">\n<|DSML|parameter name="page" string="false">62</|DSML|parameter>\n</|DSML|invoke>\n</|DSML|calls>'
const part1 = dsml.slice(0, 45)
const part2 = dsml.slice(45)

const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const j = JSON.parse(body || '{}')
    seen.push(j)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const hasTool = (j.messages || []).some((m) => m.role === 'tool')
    if (!hasTool) {
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: part1 } }] }) + '\n\n')
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: part2 } }] }) + '\n\n')
      res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
    } else {
      res.write('data: {"choices":[{"delta":{"content":"读到第62页内容"}}]}\n\n')
    }
    res.end('data: [DONE]\n\n')
  })
})
await new Promise((r) => srv.listen(4409, '127.0.0.1', r))

const post = (p, b) => fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

try {
  await post('/api/config', { baseUrl: 'http://127.0.0.1:4409/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' })
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const doc = st.docs.find((d) => d.kind === 'pdf' && d.pages >= 62)

  const res = await (await post('/api/ask', { docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '怎么用x趋近于正无穷的极限定义e？' })).text()
  const second = seen.find((x) => (x.messages || []).some((m) => m.role === 'tool'))
  const toolMsg = second ? second.messages.find((m) => m.role === 'tool').content : ''
  const node = await (await fetch('http://127.0.0.1:4317/api/doc/' + doc.id)).json()
  const nodes = Object.values(node.tree.nodes).sort((a, b) => a.createdAt - b.createdAt)
  const last = nodes[nodes.length - 1]

  console.log(JSON.stringify({
    doc: doc.title,
    sseHasDSML: res.includes('DSML'),
    rounds: seen.length,
    toolCalled: !!second,
    toolHasPage62: String(toolMsg).includes('第 62 页'),
    answer: (last.answer || '').slice(0, 30)
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  srv.close()
}
