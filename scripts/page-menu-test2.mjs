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
    seen.push(body)
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n')
    res.end('data: [DONE]\n\n')
  })
})
await new Promise((r) => srv.listen(4402, '127.0.0.1', r))
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const page = await b.newPage()
try {
  await fetch('http://127.0.0.1:4317/api/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseUrl: 'http://127.0.0.1:4402/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' }) })
  await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('dt:seenWelcome', '1'))
  const id = await page.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
  await page.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.page', { timeout: 20000 })
  await new Promise(r => setTimeout(r, 1000))
  await page.evaluate(() => { const el = document.querySelector('.page[data-page="2"]') || document.querySelectorAll('.page')[1]; el.scrollIntoView({ block: 'center' }) })
  await new Promise(r => setTimeout(r, 500))
  const box = await page.evaluate(() => { const el = document.querySelector('.page[data-page="2"]') || document.querySelectorAll('.page')[1]; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + 100 } })
  await page.mouse.click(box.x, box.y, { button: 'right' })
  await new Promise(r => setTimeout(r, 250))
  await page.click('#pm-explain')
  await new Promise(r => setTimeout(r, 1400))
  const info = await page.evaluate(async () => {
    const st = await (await fetch('/api/state')).json()
    const d = await (await fetch('/api/doc/' + st.docs.find(x => x.kind === 'pdf').id)).json()
    const nodes = Object.values(d.tree.nodes).sort((a,b) => a.createdAt - b.createdAt)
    const last = nodes[nodes.length - 1]
    return { q: last.question, page: last.anchor?.page, anchorKind: last.anchor?.kind, count: nodes.length }
  })
  console.log(JSON.stringify({ info, reqHasPage2: seen.some(s => s.includes('第 2 页，本页内容')), reqHasAsk: seen.some(s => s.includes('请讲解第 2 页')), errs: [] }))
} finally {
  fs.writeFileSync(CONFIG, backup)
  await b.close(); srv.close()
}
