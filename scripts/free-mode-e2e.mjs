import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const seen = []
const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const j = JSON.parse(body || '{}')
    seen.push(j)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const hasTool = (j.messages || []).some((m) => m.role === 'tool')
    if (Array.isArray(j.tools) && j.tools.length && !hasTool) {
      res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"s1","function":{"name":"search_docs","arguments":"{\\"query\\":\\"shape\\"}"}}]}}]}\n\n')
      res.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n')
    } else {
      res.write('data: {"choices":[{"delta":{"content":"检索到 shape 相关段落"}}]}\n\n')
    }
    res.end('data: [DONE]\n\n')
  })
})
await new Promise(r => srv.listen(4408, '127.0.0.1', r))
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
try {
  await fetch('http://127.0.0.1:4317/api/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseUrl: 'http://127.0.0.1:4408/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' }) })
  await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
  await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
  const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf' && d.pages >= 8)?.id })
  await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
  await p.waitForSelector('.page', { timeout: 20000 })
  await new Promise(r => setTimeout(r, 1200))
  await p.evaluate(() => { const i = document.querySelector('#page-input'); i.value = '7'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  await new Promise(r => setTimeout(r, 700))
  await p.click('#q')
  await p.keyboard.type('shape 的  和 1 是什么意思')
  await p.click('#btn-send')
  await new Promise(r => setTimeout(r, 2000))
  const ask = seen.filter(x => Array.isArray(x.tools) && x.tools.length)
  const first = ask[0] || {}
  const sys = (first.messages || []).find(m => m.role === 'system')?.content || ''
  const toolReq = ask.find(x => (x.messages || []).some(m => m.role === 'tool'))
  const toolMsg = toolReq ? (toolReq.messages.find(m => m.role === 'tool').content || '') : ''
  const node = await p.evaluate(async (id) => {
    const d = await (await fetch('/api/doc/' + id)).json()
    const nodes = Object.values(d.tree.nodes).sort((a, b) => a.createdAt - b.createdAt)
    return nodes[nodes.length - 1]
  }, id)
  console.log(JSON.stringify({ askCount: ask.length, systemHasFree: sys.includes('没有选中文字'), toolHasShape: String(toolMsg).includes('shape'), anchorPage: node?.anchor?.page, answer: String(node?.answer || '').slice(0, 20) }, null, 1))
} finally {
  fs.writeFileSync(CONFIG, backup)
  await b.close(); srv.close()
}
