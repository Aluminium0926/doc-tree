import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const seen = []

function sse(res, chunks) {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  for (const c of chunks) res.write(`event: x\ndata: ${JSON.stringify(c)}\n\n`)
  res.end()
}

const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    let j = {}
    try {
      j = JSON.parse(body)
    } catch {}
    seen.push({ url: req.url, key: req.headers['x-api-key'], ver: req.headers['anthropic-version'], model: j.model, stream: j.stream, system: Boolean(j.system), messages: j.messages })
    if (j.stream) {
      sse(res, [
        { type: 'message_start' },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '你' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '好' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '想一下' } },
        { type: 'message_stop' }
      ])
    } else {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ content: [{ type: 'text', text: '摘要内容' }] }))
    }
  })
})
await new Promise((r) => srv.listen(4401, '127.0.0.1', r))

const post = (p, body) =>
  fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

try {
  await post('/api/config', {
    baseUrl: 'http://127.0.0.1:4401/v1',
    apiKey: 'ak-test',
    model: 'claude-test',
    apiFormat: 'anthropic',
    visionModel: 'claude-vision',
    visionBaseUrl: 'http://127.0.0.1:4401/v1',
    visionApiKey: 'ak-vision',
    visionFormat: 'anthropic'
  })
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const docId = st.docs[0].id

  const textRes = await (await post('/api/ask', { docId, anchor: { kind: 'doc', page: 1, quote: 'x' }, question: '解释' })).text()
  const textDeltas = textRes.split('\n\n').filter((l) => l.startsWith('data:')).map((l) => {
    try {
      return JSON.parse(l.slice(5))
    } catch {
      return null
    }
  }).filter((e) => e && e.type === 'delta')
  const textAnswer = textDeltas.map((d) => d.text).join('')
  const reasoning = textRes.includes('reasoning') || textRes.includes('想一下')

  await (await post('/api/ask', {
    docId,
    anchor: { kind: 'doc', page: 1, quote: 'x' },
    question: '看图',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  })).text()

  const visionReq = seen[seen.length - 1]
  const hasImage = JSON.stringify(visionReq.messages).includes('"type":"image"') && JSON.stringify(visionReq.messages).includes('base64')

  console.log(JSON.stringify({
    textReq: { url: seen[0].url, key: seen[0].key, ver: seen[0].ver, model: seen[0].model, stream: seen[0].stream, system: seen[0].system },
    textAnswer,
    reasoning,
    visionReq: { key: visionReq.key, model: visionReq.model, hasImage },
    seenCount: seen.length
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  srv.close()
}
