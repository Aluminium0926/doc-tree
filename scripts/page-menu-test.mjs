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
    let j = {}
    try {
      j = JSON.parse(body)
    } catch {}
    seen.push({ model: j.model, stream: j.stream, text: JSON.stringify(j.messages || '').slice(0, 400) })
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write('data: {"choices":[{"delta":{"content":"本页讲了神经系统"}}]}\n\n')
    res.end('data: [DONE]\n\n')
  })
})
await new Promise((r) => srv.listen(4402, '127.0.0.1', r))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))

try {
  await fetch('http://127.0.0.1:4317/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseUrl: 'http://127.0.0.1:4402/v1', apiKey: 'k', model: 'm', apiFormat: 'openai' })
  })
  await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('dt:seenWelcome', '1'))
  const id = await page.evaluate(async () => {
    const st = await (await fetch('/api/state')).json()
    return st.docs.find((d) => d.kind === 'pdf')?.id
  })
  await page.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.page', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1200))

  await page.evaluate(() => {
    const el = document.querySelector('.page[data-page="2"]') || document.querySelectorAll('.page')[1]
    el.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 600))
  const box = await page.evaluate(() => {
    const el = document.querySelector('.page[data-page="2"]') || document.querySelectorAll('.page')[1]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + 120, p: el.dataset.page }
  })
  await page.mouse.click(box.x, box.y, { button: 'right' })
  await new Promise((r) => setTimeout(r, 300))
  const menu = await page.evaluate(() => ({
    visible: !document.querySelector('#page-menu').hidden,
    text: document.querySelector('#pm-explain')?.textContent
  }))
  await page.screenshot({ path: 'page-menu.png' })
  await page.click('#pm-explain')
  await new Promise((r) => setTimeout(r, 1200))
  const node = await page.evaluate(() => {
    const q = document.querySelector('.node-q')
    return q ? q.textContent : null
  })
  console.log(JSON.stringify({ box, menu, node, req: seen[0] ? { model: seen[0].model, hasPageText: seen[0].text.includes('第 2 页') || seen[0].text.includes('第2页') } : null, errs }))
} finally {
  fs.writeFileSync(CONFIG, backup)
  await browser.close()
  srv.close()
}
