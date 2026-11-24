// 窄窗口复现：800×900 下 边界拖动 / 收起 / 划词浮层
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2]
const W = Number(process.argv[3] || 800)
const H = Number(process.argv[4] || 900)

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: W, height: H }
})
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1500))

const snap = () =>
  page.evaluate(() => {
    const app = document.querySelector('#app')
    const r = document.querySelector('#resizer-right').getBoundingClientRect()
    const v = document.querySelector('#page-scroll').getBoundingClientRect()
    return {
      inner: window.innerWidth,
      cols: getComputedStyle(app).gridTemplateColumns,
      resizerX: Math.round(r.x),
      viewerW: Math.round(v.width),
      pageW: Math.round(document.querySelector('.page').getBoundingClientRect().width)
    }
  })

console.log('初始:', JSON.stringify(await snap()))

// 收起左栏
await page.click('#btn-collapse')
await new Promise((r) => setTimeout(r, 700))
console.log('收起后:', JSON.stringify(await snap()))

// 拖右边界（往左，想加宽右栏）
const rb = await page.evaluate(() => {
  const b = document.querySelector('#resizer-right').getBoundingClientRect()
  return { x: b.x + b.width / 2, y: 400 }
})
await page.mouse.move(rb.x, rb.y)
await page.mouse.down()
await page.mouse.move(rb.x - 120, rb.y, { steps: 10 })
await page.mouse.up()
await new Promise((r) => setTimeout(r, 700))
console.log('右拖 -120 后:', JSON.stringify(await snap()))

// 再往右拖（收窄右栏）
const rb2 = await page.evaluate(() => {
  const b = document.querySelector('#resizer-right').getBoundingClientRect()
  return { x: b.x + b.width / 2, y: 400 }
})
await page.mouse.move(rb2.x, rb2.y)
await page.mouse.down()
await page.mouse.move(rb2.x + 120, rb2.y, { steps: 10 })
await page.mouse.up()
await new Promise((r) => setTimeout(r, 700))
console.log('右拖 +120 后:', JSON.stringify(await snap()))

// 划词浮层
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
await new Promise((r) => setTimeout(r, 300))
const float = await page.evaluate(() => {
  const m = document.querySelector('#float-menu')
  const b = m.getBoundingClientRect()
  return { hidden: m.hidden, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), inside: b.right <= window.innerWidth && b.left >= 0 }
})
console.log('浮层:', JSON.stringify(float))

await page.screenshot({ path: 'shot-narrow.png' })
await browser.close()
