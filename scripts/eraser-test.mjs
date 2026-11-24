// 擦除回归：建高亮 → 开擦除 → 点掉
import puppeteer from 'puppeteer-core'

const DOC = '67078ceda252'
const BASE = 'http://127.0.0.1:4317'

await fetch(`${BASE}/api/highlights`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ docId: DOC, highlights: [] })
}).catch(() => {})

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)))
await page.goto(`${BASE}/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1500))

// 建高亮
await page.click('#btn-hl')
await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  const r = document.createRange()
  r.setStart(spans[1].firstChild, 0)
  r.setEnd(spans[3].firstChild, spans[3].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 900))
await page.click('#btn-hl')
console.log('建立后高亮数:', await page.evaluate(() => document.querySelectorAll('.hl').length))

// 开擦除
await page.click('#btn-eraser')
const box = await page.evaluate(() => {
  const r = document.querySelector('.hl').getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(box.x, box.y)
await new Promise((r) => setTimeout(r, 900))
console.log('擦除后高亮数:', await page.evaluate(() => document.querySelectorAll('.hl').length))
console.log('toast:', await page.evaluate(() => {
  const t = document.querySelector('#toast')
  return t.hidden ? '(隐藏)' : t.textContent
}))

const saved = await fetch(`${BASE}/api/doc/${DOC}`).then((r) => r.json())
console.log('服务端保存:', (saved.doc.highlights || []).length)
console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
