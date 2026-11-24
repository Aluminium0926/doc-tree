import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
const id = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  return st.docs.find((d) => d.kind === 'pdf')?.id
})
await page.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 800))

const btn = await page.$('#btn-zoom-in')
const bb = await btn.boundingBox()
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
await page.mouse.down()
await new Promise((r) => setTimeout(r, 900))
const during = await page.evaluate(() => document.querySelector('#zoom-label').textContent)
await page.mouse.up()
await new Promise((r) => setTimeout(r, 500))
const after = await page.evaluate(() => ({
  label: document.querySelector('#zoom-label').textContent,
  cw: document.querySelector('.page canvas')?.width
}))
console.log(JSON.stringify({ during, after }))
await page.screenshot({ path: 'zoom-hold.png', clip: { x: 560, y: 0, width: 340, height: 56 } })
await browser.close()
