import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')

function sse(res, lines) {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  for (const l of lines) res.write(l + '\n\n')
  res.end()
}

function openaiMock(port) {
  const seen = []
  const srv = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const j = JSON.parse(body || '{}')
      seen.push(j.messages)
      const hasToolResult = (j.messages || []).some((m) => m.role === 'tool')
      if (!hasToolResult) {
        sse(res, [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_page","arguments":"{\\"page\\":42}"}}]}}]}',
          'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
          'data: [DONE]'
        ])
      } else {
        sse(res, [
          'data: {"choices":[{"delta":{"content":"读到了第 42 页"}}]}',
          'data: [DONE]'
        ])
      }
    })
  })
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, seen })))
}

function anthropicMock(port) {
  const seen = []
  const srv = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const j = JSON.parse(body || '{}')
      seen.push(j.messages)
      const hasResult = JSON.stringify(j.messages || '').includes('tool_result')
      if (!hasResult) {
        sse(res, [
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu_1","name":"read_page"}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"page\\":42}"}}',
          'event: message_stop\ndata: {"type":"message_stop"}'
        ])
      } else {
        sse(res, [
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Anthropic 读到第 42 页"}}',
          'event: message_stop\ndata: {"type":"message_stop"}'
        ])
      }
    })
  })
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, seen })))
}

const post = (p, b) =>
  fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })

const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc = st.docs.find((d) => d.kind === 'pdf' && d.pages >= 42)
const oa = await openaiMock(4404)
const an = await anthropicMock(4405)

try {
  await post('/api/config', { baseUrl: 'http://127.0.0.1:4404/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' })
  const r1 = await (await post('/api/ask', { docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '再讲到42页' })).text()

  await post('/api/config', { baseUrl: 'http://127.0.0.1:4405/v1', apiKey: 'k', model: 'm', apiFormat: 'anthropic' })
  const r2 = await (await post('/api/ask', { docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '再讲到42页' })).text()

  const toolMsg = (oa.seen[1] || []).find((m) => m.role === 'tool')
  const anTool = JSON.stringify(an.seen[1] || '').includes('第 42 页')

  console.log(JSON.stringify({
    doc: doc.title,
    openaiRounds: oa.seen.length,
    openaiToolsSent: JSON.stringify(oa.seen[0] || '').includes('"read_page"'),
    openaiToolResultHas42: (toolMsg?.content || '').includes('第 42 页'),
    openaiAnswer: r1.includes('读到了第 42 页'),
    anthropicRounds: an.seen.length,
    anthropicToolResultHas42: anTool,
    anthropicAnswer: r2.includes('Anthropic 读到第 42 页')
  }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  oa.srv.close()
  an.srv.close()
}
