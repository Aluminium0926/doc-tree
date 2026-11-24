import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4501'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
await page.evaluate(() =>
  localStorage.setItem('dt:config', JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-flash', effort: 'low' }))
)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))

const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await page.waitForSelector('.sheet', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 800))

const first = await page.evaluate(async () => (await (await fetch('/api/state')).json()).docs[0])
await page.evaluate(async (id) => {
  await fetch('/api/doc/' + id, { method: 'DELETE' })
}, first.id)
const hiddenState = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  return st.docs.map((d) => ({ id: d.id, hidden: d.hidden }))
})
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))
const archCount = await page.evaluate(() => document.querySelectorAll('#doc-list .doc-item.archived').length)

const input2 = await page.$('#file-input')
await input2.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await new Promise((r) => setTimeout(r, 1500))
const revived = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  return { docs: st.docs.map((d) => ({ id: d.id, hidden: d.hidden })), cards: document.querySelectorAll('.code-card').length }
})
console.log(JSON.stringify({ firstId: first.id, hiddenState, archCount, revived, errs: errs.slice(0, 2) }))
await browser.close()
