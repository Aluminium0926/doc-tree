import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const seen = []

const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const j = JSON.parse(body || '{}')
    seen.push(j)
    if (j.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"按指令回答"}}]}\n\n')
      res.end('data: [DONE]\n\n')
    } else {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: '收到，之后用英文' } }] }))
    }
  })
})
await new Promise((r) => srv.listen(4412, '127.0.0.1', r))

const base = 'http://127.0.0.1:4317'
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

try {
  await post('/api/config', { baseUrl: 'http://127.0.0.1:4412/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' })
  const st = await (await fetch(base + '/api/state')).json()
  const doc = st.docs.find((d) => !d.hidden && d.kind === 'pdf')
  const before = await (await fetch(base + '/api/doc/' + doc.id)).json()
  const beforeNodes = Object.keys(before.tree.nodes).length

  const r = await (await post('/api/instruction', { docId: doc.id, text: '以后用英文回答' })).json()
  const after = await (await fetch(base + '/api/doc/' + doc.id)).json()
  const afterNodes = Object.keys(after.tree.nodes).length

  const ask = await (await post('/api/ask', { docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '这是什么' })).text()
  const askBody = seen.find((x) => x.stream)
  const sys = (askBody.messages || []).find((m) => m.role === 'system')?.content || ''

  console.log(JSON.stringify({
    reply: r.reply,
    count: r.count,
    stored: after.doc.instructions,
    treeUnchanged: beforeNodes === afterNodes,
    askHasInstruction: sys.includes('用户附加指令') && sys.includes('以后用英文回答'),
    askStreamed: ask.includes('按指令回答')
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  srv.close()
}
