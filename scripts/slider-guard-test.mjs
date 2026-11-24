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
await new Promise((r) => setTimeout(r, 800))

const rects = await page.evaluate(() => {
  const r = (s) => {
    const b = document.querySelector(s).getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }
  return { resizer: r('#resizer-right'), effort: r('#effort'), side: r('#sidebar'), composer: r('#composer') }
})
console.log('rects', JSON.stringify(rects))

const widthOf = () => page.evaluate(() => Math.round(document.querySelector('#sidebar').getBoundingClientRect().width))

// 1) 在分栏条上、与滑块同一高度开始拖：应被 composer 区域守卫拦住
const w0 = await widthOf()
await page.mouse.move(rects.resizer.x + 4, rects.effort.y + 10)
await page.mouse.down()
await page.mouse.move(rects.resizer.x - 60, rects.effort.y + 10, { steps: 6 })
await page.mouse.up()
const w1 = await widthOf()

// 2) 拖滑块：值应变，宽度不变
const v0 = await page.evaluate(() => document.querySelector('#effort').value)
await page.mouse.move(rects.effort.x + 20, rects.effort.y + rects.effort.h / 2)
await page.mouse.down()
await page.mouse.move(rects.effort.x + rects.effort.w - 6, rects.effort.y + rects.effort.h / 2, { steps: 8 })
await page.mouse.up()
const after = await page.evaluate(() => ({
  v: document.querySelector('#effort').value,
  label: document.querySelector('#effort-label').textContent,
  w: Math.round(document.querySelector('#sidebar').getBoundingClientRect().width)
}))

// 3) 分栏条中部仍然能拖
await page.mouse.move(rects.resizer.x + 4, 400)
await page.mouse.down()
await page.mouse.move(rects.resizer.x - 80, 400, { steps: 6 })
await page.mouse.up()
const w2 = await widthOf()

console.log(JSON.stringify({ w0, w1, sliderValueBefore: v0, sliderAfter: after, wAfterMidDrag: w2, errors: errs }))
await browser.close()
