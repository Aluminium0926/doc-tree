// 验证翻页是"瞬切"而不是动画
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/?doc=67078ceda252', { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1200))

const read = () => page.evaluate(() => Math.round(document.querySelector('#page-scroll').scrollTop))

console.log('前:', await read())
await page.keyboard.press('ArrowRight')
console.log('按下后立刻:', await read())
await new Promise((r) => setTimeout(r, 120))
console.log('120ms 后:', await read())
await browser.close()
