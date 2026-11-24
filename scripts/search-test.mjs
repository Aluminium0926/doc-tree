// 搜索按钮 / 快捷键
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)))
await page.goto('http://127.0.0.1:4317/?doc=67078ceda252', { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1200))

console.log('按钮存在:', await page.evaluate(() => Boolean(document.querySelector('#btn-search'))))
await page.click('#btn-search')
await new Promise((r) => setTimeout(r, 300))
console.log('点击后:', await page.evaluate(() => ({
  bar: !document.querySelector('#search-bar').hidden,
  focus: document.activeElement.id
})))
await page.keyboard.type('bone', { delay: 30 })
await new Promise((r) => setTimeout(r, 1000))
console.log('搜索:', await page.evaluate(() => ({
  count: document.querySelector('#search-count').textContent,
  hits: document.querySelectorAll('.search-hit').length
})))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 300))
console.log('Esc 关闭:', await page.evaluate(() => document.querySelector('#search-bar').hidden))
await page.screenshot({ path: 'shot-search.png' })
console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
