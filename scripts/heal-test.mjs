// 白屏自愈：手动清空画布 → 触发 focus → 检查是否重绘
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1400, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)))
await page.goto('http://127.0.0.1:4317/?doc=67078ceda252', { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 2000))

const sample = () =>
  page.evaluate(() => {
    const c = document.querySelector('.page canvas')
    const ctx = c.getContext('2d', { willReadFrequently: true })
    const d = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data
    return { w: c.width, alpha: d[3] }
  })

console.log('初始:', JSON.stringify(await sample()))

// 模拟系统回收画布：清空并让尺寸归零
await page.evaluate(() => {
  const c = document.querySelector('.page canvas')
  c.getContext('2d').clearRect(0, 0, c.width, c.height)
})
console.log('清空后:', JSON.stringify(await sample()))

// 触发 focus（模拟切回前台）
await page.evaluate(() => window.dispatchEvent(new Event('focus')))
await new Promise((r) => setTimeout(r, 1500))
console.log('focus 后:', JSON.stringify(await sample()))

// 再清空，用 visibilitychange 触发
await page.evaluate(() => {
  const c = document.querySelector('.page canvas')
  c.getContext('2d').clearRect(0, 0, c.width, c.height)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
await new Promise((r) => setTimeout(r, 1500))
console.log('visibility 后:', JSON.stringify(await sample()))

console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
