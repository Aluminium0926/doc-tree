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
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('CERR ' + m.text().slice(0, 120))
})
await page.evaluateOnNewDocument(() => {
  window.__opened = []
  window.open = (u) => {
    window.__opened.push(u)
    return null
  }
})

await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))
const welcome = await page.evaluate(() => ({
  visible: !document.querySelector('#welcome').hidden,
  ver: document.querySelector('#welcome-ver')?.textContent,
  update: !document.querySelector('#update').hidden
}))

await page.click('#welcome-ok')
await new Promise((r) => setTimeout(r, 3500))
const after = await page.evaluate(() => ({
  update: !document.querySelector('#update').hidden,
  checkedAt: localStorage.getItem('dt:verCheckAt'),
  text: document.querySelector('#update-text')?.textContent?.slice(0, 80)
}))
await page.screenshot({ path: 'welcome-ver.png' })
console.log(JSON.stringify({ welcome, after, errs: errs.slice(0, 3) }))
await browser.close()
