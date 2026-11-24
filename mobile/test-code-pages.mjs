import puppeteer from 'puppeteer-core'

const URL = 'https://aluminium0926.github.io/doc-tree/'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900 }
})
const page = await browser.newPage()
const bad = []
page.on('response', (r) => {
  if (r.status() >= 400) bad.push(r.status() + ' ' + r.url())
})
page.on('pageerror', (e) => bad.push('ERR ' + e.message.slice(0, 120)))

await page.goto(URL, { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('dt:config', JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-flash', effort: 'low' })))
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await page.waitForSelector('.code-card', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 1000))
console.log(JSON.stringify(await page.evaluate(() => ({
  cards: document.querySelectorAll('.code-card').length,
  hl: document.querySelectorAll('.code-card code.hljs').length,
  btns: document.querySelectorAll('.code-btn').length,
  langs: [...document.querySelectorAll('.code-lang')].map((e) => e.textContent)
}))))
console.log('bad:', bad.slice(0, 5).join(' | ') || '(无)')
await (await page.$('.code-card')).screenshot({ path: 'code-card-pages.png' })
await browser.close()
