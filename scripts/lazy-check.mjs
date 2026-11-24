// 检查懒加载：统计真正绘制过的 canvas（占位 canvas 默认 300x150）
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 2500))

const stat = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.page')]
  const drawn = pages.filter((p) => p.querySelector('canvas').width !== 300)
  const sc = document.querySelector('#page-scroll')
  const rects = pages.slice(0, 3).map((p) => Math.round(p.getBoundingClientRect().top))
  const last = Math.round(pages[pages.length - 1].getBoundingClientRect().top)
  return {
    total: pages.length,
    drawn: drawn.length,
    scrollerH: Math.round(sc.getBoundingClientRect().height),
    scrollH: sc.scrollHeight,
    tops: rects,
    lastTop: last
  }
})
console.log(JSON.stringify(stat, null, 2))

await page.evaluate(() => {
  document.querySelector('#page-scroll').scrollTop = 4000
})
await new Promise((r) => setTimeout(r, 1500))
const after = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.page')]
  return pages.filter((p) => p.querySelector('canvas').width !== 300).length
})
console.log('滚动到 4000px 后已绘制:', after)
await browser.close()
