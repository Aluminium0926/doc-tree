// 快速截图 + 布局体检
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const [doc, out = 'shot-layout.png'] = process.argv.slice(2)

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`http://127.0.0.1:4317/?doc=${doc}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2200))

const info = await page.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const b = e.getBoundingClientRect()
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }
  }
  const sc = document.querySelector('#page-scroll')
  return {
    viewportH: innerHeight,
    composer: r('#composer'),
    send: r('#btn-send'),
    scroller: r('#page-scroll'),
    scrollable: sc ? sc.scrollHeight > sc.clientHeight + 10 : null,
    renderedPages: [...document.querySelectorAll('.page canvas')].filter((c) => c.width !== 300).length,
    sheet: r('#sheet')
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: out })
if (errs.length) console.log('errors:', errs.join('\n'))
await browser.close()
