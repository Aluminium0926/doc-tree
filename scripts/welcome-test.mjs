import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))

await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))
const first = await page.evaluate(() => ({
  visible: !document.querySelector('#welcome').hidden,
  text: document.querySelector('.welcome-card .ask-text')?.innerText,
  link: document.querySelector('#welcome-repo')?.href,
  flag: localStorage.getItem('dt:seenWelcome')
}))
await page.screenshot({ path: 'welcome.png' })

await page.click('#welcome-ok')
await new Promise((r) => setTimeout(r, 300))
const closed = await page.evaluate(() => ({
  visible: !document.querySelector('#welcome').hidden,
  flag: localStorage.getItem('dt:seenWelcome')
}))

await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))
const second = await page.evaluate(() => ({ visible: !document.querySelector('#welcome').hidden }))
console.log(JSON.stringify({ first, closed, second, errs }))
await browser.close()
