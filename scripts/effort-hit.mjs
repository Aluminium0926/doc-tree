import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1638, height: 1048 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 800))

const info = await page.evaluate(() => {
  const b = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  const eff = document.querySelector('#effort').getBoundingClientRect()
  const y = eff.y + eff.height / 2
  const scan = []
  for (let x = eff.x - 30; x <= eff.x + eff.width + 30; x += 6) {
    const stack = document.elementsFromPoint(x, y).map((e) => e.id || e.className || e.tagName).slice(0, 3)
    scan.push({ x: Math.round(x), stack })
  }
  return { resizerRight: b('#resizer-right'), effort: b('#effort'), composerFoot: b('.composer-foot'), scan }
})
console.log(JSON.stringify(info, null, 1))

// 模拟拖动滑块，看分栏宽度是否被改
const before = await page.evaluate(() => document.querySelector('#sidebar').getBoundingClientRect().width)
const eff = info.effort
await page.mouse.move(eff.x + eff.w / 2, eff.y + 2)
await page.mouse.down()
await page.mouse.move(eff.x + eff.w / 2 + 60, eff.y + 2, { steps: 8 })
await page.mouse.up()
const after = await page.evaluate(() => ({
  side: document.querySelector('#sidebar').getBoundingClientRect().width,
  value: document.querySelector('#effort').value,
  label: document.querySelector('#effort-label').textContent
}))
console.log('拖前宽度', before, '拖后', JSON.stringify(after))
await browser.close()
