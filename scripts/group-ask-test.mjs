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
    seen.push(body)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: {"choices":[{"delta":{"content":"组的回答"}}]}\n\n')
    res.end('data: [DONE]\n\n')
  })
})
await new Promise((r) => srv.listen(4403, '127.0.0.1', r))

const post = (p, b) =>
  fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

try {
  await post('/api/config', { baseUrl: 'http://127.0.0.1:4403/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' })
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const g = st.groups[0]
  if (!g) throw new Error('没有测试组')

  const res = await (await post('/api/ask', {
    docId: g.docIds[0],
    anchor: { kind: 'doc', page: 1, quote: '' },
    question: '讲解本页内容'
  })).text()

  const reqBody = seen.find((s) => s.includes('文档组')) || seen[0] || ''
  const a = await (await fetch('http://127.0.0.1:4317/api/doc/' + g.docIds[0])).json()
  const b2 = await (await fetch('http://127.0.0.1:4317/api/doc/' + g.docIds[1])).json()

  console.log(JSON.stringify({
    groupBanner: reqBody.includes('文档组（共 2 份'),
    bothTitles: (a.doc.title && reqBody.includes(a.doc.title)) && (b2.doc.title && reqBody.includes(b2.doc.title)),
    answerStreamed: res.includes('组的回答'),
    sharedNodes: { a: Object.keys(a.tree.nodes).length, b: Object.keys(b2.tree.nodes).length },
    sameNodeIds: JSON.stringify(Object.keys(a.tree.nodes).sort()) === JSON.stringify(Object.keys(b2.tree.nodes).sort())
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  srv.close()
}
