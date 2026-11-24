import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req, res) => {
  req.resume()
  req.on('end', () => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: {"choices":[{"delta":{"content":"测试回答"}}]}\n\n'); res.end('data: [DONE]\n\n') })
})
await new Promise(r => srv.listen(4407, '127.0.0.1', r))
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
try {
  await fetch('http://127.0.0.1:4317/api/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseUrl: 'http://127.0.0.1:4407/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' }) })
  await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
  await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
  const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf' && d.pages >= 8)?.id })
  await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
  await p.waitForSelector('.page', { timeout: 20000 })
  await new Promise(r => setTimeout(r, 1200))
  await p.evaluate(() => { const i = document.querySelector('#page-input'); i.value = '7'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  await new Promise(r => setTimeout(r, 900))
  const cur = await p.evaluate(() => document.querySelector('#page-input').value)
  await p.click('#q')
  await p.keyboard.type('这一页讲了什么')
  await p.click('#btn-send')
  await new Promise(r => setTimeout(r, 1800))
  const node = await p.evaluate(async (id) => {
    const d = await (await fetch('/api/doc/' + id)).json()
    const nodes = Object.values(d.tree.nodes).sort((a, b) => a.createdAt - b.createdAt)
    return nodes[nodes.length - 1]
  }, id)
  console.log(JSON.stringify({ currentPageInput: cur, anchorPage: node?.anchor?.page, question: node?.question, errs: [] }))
} finally {
  fs.writeFileSync(CONFIG, backup)
  await b.close(); srv.close()
}
