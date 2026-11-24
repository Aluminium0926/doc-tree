import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4317'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
const docId = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  for (const d of st.docs) {
    const t = await (await fetch('/api/doc/' + d.id)).json()
    if (Object.keys(t.tree?.nodes || {}).length) return d.id
  }
})
await page.evaluate(() => {
  const cur = window.DTTheme.load()
  window.DTTheme.save({ ...cur, mode: 'light' })
})
await page.goto(`${BASE}/?doc=${docId}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))
await page.click('#btn-treeview')
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: 'treeview-light.png' })

// 再看深色
await page.evaluate(() => {
  const cur = window.DTTheme.load()
  window.DTTheme.save({ ...cur, mode: 'dark' })
})
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1200))
await page.click('#btn-treeview')
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: 'treeview-dark.png' })
console.log('errors:', errs.slice(0, 3).join(' | ') || '(无)')
await browser.close()
