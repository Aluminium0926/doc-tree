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
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.url().startsWith('https://api.github.com/repos/Aluminium0926/doc-tree/releases')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([{ tag_name: 'v9.9.9', draft: false, prerelease: false }])
    })
  }
  req.continue()
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
await page.click('#welcome-ok')
await new Promise((r) => setTimeout(r, 1600))
const upd = await page.evaluate(() => ({
  visible: !document.querySelector('#update').hidden,
  text: document.querySelector('#update-text')?.innerText?.slice(0, 80)
}))
await page.screenshot({ path: 'update-modal.png' })

// 勾选不再提醒 + 稍后
await page.click('#update-skip')
await page.click('#update-later')
await new Promise((r) => setTimeout(r, 300))
const skipped = await page.evaluate(() => ({
  hidden: document.querySelector('#update').hidden,
  skip: localStorage.getItem('dt:skipVersion')
}))

// 清除时间戳后再次检查：应被 skip 挡住
await page.evaluate(() => localStorage.removeItem('dt:verCheckAt'))
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2600))
const again = await page.evaluate(() => ({ visible: !document.querySelector('#update').hidden }))

console.log(JSON.stringify({ upd, skipped, again, errs }))
await browser.close()
