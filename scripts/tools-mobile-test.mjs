import http from 'node:http'
import puppeteer from 'puppeteer-core'
const seen = []
const srv = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST,OPTIONS' }
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const j = JSON.parse(body || '{}')
    seen.push(j)
    res.writeHead(200, { ...cors, 'content-type': 'text/event-stream' })
    const hasTool = (j.messages || []).some((m) => m.role === 'tool')
    if (!hasTool) {
      res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_page","arguments":"{\\"page\\":1}"}}]}}]}\n\n')
      res.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n')
    } else {
      res.write('data: {"choices":[{"delta":{"content":"手机读到第一页"}}]}\n\n')
    }
    res.end('data: [DONE]\n\n')
  })
})
await new Promise((r) => srv.listen(4406, '127.0.0.1', r))
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
await p.evaluate(async () => {
  const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
  for (const r of regs) await r.unregister()
  localStorage.setItem('dt:seenWelcome','1')
  localStorage.setItem('dt:config', JSON.stringify({ baseUrl: 'http://127.0.0.1:4406/v1', apiKey: 'k', model: 'm', apiFormat: 'openai', temperature: 0.3 }))
})
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
const input = await p.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/g1.md')
await new Promise(r => setTimeout(r, 1600))
const out = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const doc = st.docs[0]
  const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ docId: doc.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '讲讲第1页' }) })
  const text = await res.text()
  return { ok: res.ok, hasAnswer: text.includes('手机读到第一页'), err: (text.match(/"message":"([^"]+)"/) || [])[1] || '' }
})
const askReqs = seen.filter(x => Array.isArray(x.tools) && x.tools.length)
const toolReq = seen.find(x => (x.messages || []).some(m => m.role === 'tool'))
const toolMsg = toolReq ? JSON.stringify(toolReq.messages.find(m => m.role === 'tool').content) : ''
console.log(JSON.stringify({ out, total: seen.length, askReqs: askReqs.length, toolResultHasPage: toolMsg.includes('第 1 页'), toolResultHasText: toolMsg.includes('sys.path'), errs }))
await b.close(); srv.close()
