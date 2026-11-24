// 树状图验证
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
await new Promise((r) => setTimeout(r, 1500))

await page.click('#btn-treeview')
await new Promise((r) => setTimeout(r, 600))

const info = await page.evaluate(() => {
  const svg = document.querySelector('#tv-svg')
  return {
    open: !document.querySelector('#treeview').hidden,
    groups: svg.querySelectorAll('g > g').length,
    rects: svg.querySelectorAll('rect').length,
    paths: svg.querySelectorAll('path').length,
    texts: [...svg.querySelectorAll('.tv-q')].map((e) => e.textContent.slice(0, 14))
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'shot-treeview.png' })

// 点第一个节点
await page.evaluate(() => {
  const g = document.querySelector('#tv-svg g > g')
  g.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 500))
console.log('点击后关闭:', await page.evaluate(() => document.querySelector('#treeview').hidden))
console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
