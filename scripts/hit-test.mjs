import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 800))

const info = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }
  const main = document.querySelector('main')
  const cs = getComputedStyle(main)
  const effort = document.querySelector('#effort').getBoundingClientRect()
  const pts = []
  for (let i = 0; i <= 4; i++) {
    const x = effort.x + (effort.width * i) / 4
    const y = effort.y + effort.height / 2
    const el = document.elementFromPoint(x, y)
    pts.push({ x: Math.round(x), y: Math.round(y), el: el ? el.id || el.className || el.tagName : null })
  }
  return {
    mainPosition: cs.position,
    app: r('#app'),
    main: r('main'),
    sidebar: r('#sidebar'),
    resizerLeft: r('#resizer-left'),
    resizerRight: r('#resizer-right'),
    effort: r('#effort'),
    hitPoints: pts
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
