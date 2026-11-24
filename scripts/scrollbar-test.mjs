import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)))
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 900))

const out = await page.evaluate(() => {
  const side = document.querySelector('#sidebar').getBoundingClientRect()
  const main = document.querySelector('main').getBoundingClientRect()
  const eff = document.querySelector('#effort').getBoundingClientRect()
  const at = (x, y) => {
    const e = document.elementFromPoint(x, y)
    return e ? e.id || e.className || e.tagName : null
  }
  return {
    mainRight: Math.round(main.right),
    sideLeft: Math.round(side.left),
    atScrollbarArea: at(main.right - 6, 400),
    atBoundaryPdfSide: at(main.right - 2, 400),
    atSidebarEdge: at(side.left + 3, 400),
    atSlider: at(eff.x + eff.width / 2, eff.y + eff.height / 2),
    effortRect: { x: Math.round(eff.x), y: Math.round(eff.y), w: Math.round(eff.width), h: Math.round(eff.height) }
  }
})

// 拖侧栏内侧抓取区：宽度应变
const w0 = await page.evaluate(() => Math.round(document.querySelector('#sidebar').getBoundingClientRect().width))
const sideX = await page.evaluate(() => document.querySelector('#sidebar').getBoundingClientRect().x)
await page.mouse.move(sideX + 3, 400)
await page.mouse.down()
await page.mouse.move(sideX + 100, 400, { steps: 8 })
await page.mouse.up()
const w1 = await page.evaluate(() => Math.round(document.querySelector('#sidebar').getBoundingClientRect().width))

// 拖滑块：值应能改
const v0 = await page.evaluate(() => {
  const e = document.querySelector('#effort')
  e.value = 0
  e.dispatchEvent(new Event('input', { bubbles: true }))
  return e.value
})
const eff = out.effortRect
await page.mouse.move(eff.x + 8, eff.y + eff.h / 2)
await page.mouse.down()
await page.mouse.move(eff.x + eff.w - 6, eff.y + eff.h / 2, { steps: 8 })
await page.mouse.up()
const after = await page.evaluate(() => ({
  v: document.querySelector('#effort').value,
  label: document.querySelector('#effort-label').textContent,
  w: Math.round(document.querySelector('#sidebar').getBoundingClientRect().width)
}))

console.log(JSON.stringify({ ...out, dragWidth: [w0, w1], slider: { from: v0, after }, errors: errs }, null, 1))
await browser.close()
