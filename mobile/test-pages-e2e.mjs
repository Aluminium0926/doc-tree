import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const URL = 'https://aluminium0926.github.io/doc-tree/'
const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle2' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 800))

const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
await page.waitForSelector('.page canvas', { timeout: 60000 })
await new Promise((r) => setTimeout(r, 2000))
console.log('import ok, proxy state =', await page.evaluate(() => window.__DT_PROXY_STATE))

const ask = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const docId = st.docs[0].id
  const d = await (await fetch('/api/doc/' + docId)).json()
  const t0 = Date.now()
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, anchor: { kind: 'doc', page: 1, quote: (d.doc.pages[0].text || '').slice(0, 60) }, question: '一句话说明主旨' })
  })
  const text = await res.text()
  const evs = text
    .split('\n\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => {
      try {
        return JSON.parse(l.slice(5).trim())
      } catch {
        return null
      }
    })
    .filter(Boolean)
  const done = evs.find((e) => e.type === 'done')
  const err = evs.find((e) => e.type === 'error')
  return { ms: Date.now() - t0, deltas: evs.filter((e) => e.type === 'delta').length, answerLen: done?.node?.answer?.length || 0, error: err?.message || null, proxy: window.__DT_PROXY_STATE }
})
console.log('ask', JSON.stringify(ask))
console.log('errors', errs.slice(0, 3).join(' | ') || '(无)')
await page.screenshot({ path: 'pages-e2e.png' })
await browser.close()
