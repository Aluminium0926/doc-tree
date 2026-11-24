import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const hits = []

function mock(port, tag) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        hits.push({ tag, url: req.url, auth: req.headers.authorization, model: JSON.parse(body || '{}').model })
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n')
        res.end('data: [DONE]\n\n')
      })
    })
    srv.listen(port, '127.0.0.1', () => resolve(srv))
  })
}

const servers = [await mock(4398, 'text'), await mock(4399, 'vision')]

async function post(p, body) {
  const r = await fetch('http://127.0.0.1:4317' + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return r.text()
}

try {
  await post('/api/config', {
    baseUrl: 'http://127.0.0.1:4398/v1',
    apiKey: 'k1',
    model: 'text-m',
    visionModel: 'vision-m',
    visionBaseUrl: 'http://127.0.0.1:4399/v1',
    visionApiKey: 'k2'
  })

  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const docId = st.docs[0].id

  // 文本提问 → 4398
  await post('/api/ask', { docId, anchor: { kind: 'doc', page: 1, quote: 'x' }, question: '解释一下' })
  // 截图提问 → 4399
  await post('/api/ask', {
    docId,
    anchor: { kind: 'doc', page: 1, quote: 'x' },
    question: '看图',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  })

  console.log(JSON.stringify(hits, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  for (const s of servers) s.close()
}
