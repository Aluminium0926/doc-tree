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
  return st.docs.find((d) => d.kind === 'md')?.id
})
await page.evaluate(() => {
  const cur = window.DTTheme.load()
  window.DTTheme.save({ ...cur, mode: 'dark' })
})
await page.goto(`${BASE}/?doc=${docId}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: 'composer-dark.png' })

const locateVisible = await page.evaluate(() => {
  const b = document.querySelector('#btn-locate')
  return { hidden: b?.hidden, nodes: document.querySelectorAll('#tree .node').length }
})
console.log('locate:', JSON.stringify(locateVisible))
await page.click('#btn-locate').catch(() => {})
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: 'composer-locate.png' })

await page.evaluate(() => {
  const cur = window.DTTheme.load()
  window.DTTheme.save({ ...cur, mode: 'light' })
})
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: 'composer-light.png' })
console.log('errors:', errs.slice(0, 3).join(' | ') || '(无)')
await browser.close()
