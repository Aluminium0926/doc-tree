import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE || 'http://127.0.0.1:4501'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const bad = []
page.on('response', (r) => {
  if (r.status() >= 400) bad.push(r.status() + ' ' + r.url())
})
page.on('pageerror', (e) => bad.push('ERR ' + e.message.slice(0, 120)))

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
// 空 Key：不触发真实模型调用
await page.evaluate(() => localStorage.setItem('dt:config', JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-flash', effort: 'low' })))
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
const ok = await page
  .waitForSelector('.page canvas', { timeout: 30000 })
  .then(() => true)
  .catch(() => false)
console.log('canvas rendered:', ok, '| proxy state:', await page.evaluate(() => window.__DT_PROXY_STATE))
console.log('bad responses:', bad.length ? bad.slice(0, 5).join(' | ') : '(无)')
await browser.close()
