// 上下键滚动
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1400, height: 800 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/?doc=67078ceda252', { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1200))

const read = () => page.evaluate(() => Math.round(document.querySelector('#page-scroll').scrollTop))
console.log('初始:', await read())
await page.keyboard.press('ArrowDown')
await new Promise((r) => setTimeout(r, 150))
console.log('↓:', await read())
await page.keyboard.press('PageDown')
await new Promise((r) => setTimeout(r, 150))
console.log('PgDn:', await read())
await page.keyboard.press('Home')
await new Promise((r) => setTimeout(r, 150))
console.log('Home:', await read())
await browser.close()
