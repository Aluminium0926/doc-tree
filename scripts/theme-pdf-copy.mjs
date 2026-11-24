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
const ids = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  return {
    md: st.docs.find((d) => d.kind === 'md')?.id,
    pdf: st.docs.find((d) => d.kind === 'pdf')?.id
  }
})

// PDF + 浅色
await page.evaluate(() => {
  const cur = window.DTTheme.load()
  window.DTTheme.save({ ...cur, mode: 'light' })
})
await page.goto(`${BASE}/?doc=${ids.pdf}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: 'light-pdf.png' })

// 代码块复制
await page.goto(`${BASE}/?doc=${ids.md}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.code-card', { timeout: 20000 })
await page.click('.code-btn')
await new Promise((r) => setTimeout(r, 300))
const copied = await page.evaluate(() => document.querySelector('.code-btn span')?.textContent)
console.log('copy btn text:', copied)
console.log('errors:', errs.slice(0, 3).join(' | ') || '(无)')
await browser.close()
