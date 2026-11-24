// 真实模型下的 UI 截图：划词 → 讲解 → 等待完成
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'http://127.0.0.1:4317'
const DOC = process.argv[2]
const OUT = process.argv[3] || 'shot-real.png'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))

await page.goto(`${BASE}/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1200))

await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  const r = document.createRange()
  r.setStart(spans[2].firstChild, 0)
  r.setEnd(spans[6].firstChild, spans[6].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await page.waitForSelector('#float-menu:not([hidden])')
const before = await page.evaluate(() => document.querySelectorAll('#tree .node').length)
await page.evaluate(() => {
  ;[...document.querySelectorAll('#float-menu button')].find((b) => b.textContent === '讲解').click()
})

await page.waitForFunction((n) => document.querySelectorAll('#tree .node').length > n, { timeout: 30000 }, before)
await page.waitForFunction(
  () => {
    const cards = [...document.querySelectorAll('#tree .node')]
    const last = cards[cards.length - 1]
    if (!last) return false
    const ans = last.querySelector('.answer')
    return !last.querySelector('.answer.streaming') && (ans?.textContent.length || 0) > 120
  },
  { timeout: 180000 }
)
await new Promise((r) => setTimeout(r, 800))

const info = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#tree .node').length,
  hasThink: Boolean(document.querySelector('.think')),
  answerLen: document.querySelector('.answer')?.textContent.length || 0
}))
console.log(JSON.stringify(info))
await page.screenshot({ path: OUT })
console.log('errors:', errs.join('\n') || '(无)')
await browser.close()
