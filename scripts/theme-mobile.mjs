import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4501'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
page.on('response', (r) => {
  if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`)
})

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('dt:config', JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-flash', effort: 'low' })))
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))

const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await page.waitForSelector('.code-card', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: 'm-dark.png' })

// 打开主题，切浅色
await page.click('#btn-theme')
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: 'm-theme-pop.png' })
await page.click('#tp-mode button[data-mode="light"]')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: 'm-light.png' })

// 持久化：重新加载后应该是浅色
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))
const mode = await page.evaluate(() => document.documentElement.dataset.mode)
const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
console.log('after reload:', mode, bg)
console.log('errors:', errs.slice(0, 3).join(' | ') || '(无)')
await browser.close()
