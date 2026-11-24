// 左右方向键翻页
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1500))

const snap = () =>
  page.evaluate(() => {
    const sc = document.querySelector('#page-scroll')
    const pages = [...document.querySelectorAll('.page')]
    const top = sc.getBoundingClientRect().top
    let cur = 1
    let d0 = Infinity
    for (const p of pages) {
      const d = Math.abs(p.getBoundingClientRect().top - top - 10)
      if (d < d0) {
        d0 = d
        cur = +p.dataset.page
      }
    }
    return { scrollTop: Math.round(sc.scrollTop), page: cur }
  })

console.log('初始:', JSON.stringify(await snap()))

await page.keyboard.press('ArrowRight')
await new Promise((r) => setTimeout(r, 900))
console.log('→ 一次:', JSON.stringify(await snap()))

await page.keyboard.press('ArrowRight')
await new Promise((r) => setTimeout(r, 900))
console.log('→ 两次:', JSON.stringify(await snap()))

await page.keyboard.press('ArrowLeft')
await new Promise((r) => setTimeout(r, 900))
console.log('← 一次:', JSON.stringify(await snap()))

// 输入框里按方向键不应翻页
const before = await snap()
await page.click('#q')
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
await new Promise((r) => setTimeout(r, 700))
const after = await snap()
console.log('输入框内按 →:', JSON.stringify({ before: before.scrollTop, after: after.scrollTop }))

// 回到第 1 页再按 ←，应停住
await page.evaluate(() => {
  document.querySelector('#page-scroll').scrollTo({ top: 0 })
})
await new Promise((r) => setTimeout(r, 600))
await page.keyboard.press('ArrowLeft')
await new Promise((r) => setTimeout(r, 700))
console.log('首页再 ←:', JSON.stringify(await snap()))

await browser.close()
