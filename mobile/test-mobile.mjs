// 移动端端到端测试：导入 PDF → 划词 → 发送 → 流式回答
import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE || 'http://127.0.0.1:4500'
const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200))
})

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 800))

// 导入示例 PDF
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
await page.waitForSelector('.page canvas', { timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
console.log('imported, pages:', await page.evaluate(() => document.querySelectorAll('.page').length))

// 选中一段并提问
await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  const r = document.createRange()
  r.setStart(spans[6].firstChild, 0)
  r.setEnd(spans[9].firstChild, spans[9].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await page.waitForSelector('#float-menu:not([hidden])', { timeout: 5000 })
await page.click('#float-menu button')
await new Promise((r) => setTimeout(r, 400))
await page.click('#btn-send')

await page.waitForFunction(() => document.querySelector('.answer')?.textContent.trim().length > 20, { timeout: 120000 })
await new Promise((r) => setTimeout(r, 4000))
const out = await page.evaluate(() => ({
  answer: document.querySelector('.answer')?.textContent.trim().slice(0, 80),
  nodes: document.querySelectorAll('.node').length,
  libOpen: document.querySelector('#app').classList.contains('mobile-lib-open')
}))
console.log('result', JSON.stringify(out))
console.log('errors:', errs.slice(0, 5).join(' | ') || '(无)')
await page.screenshot({ path: 'mobile-shot.png' })
await browser.close()
