import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
await page.evaluate(() => localStorage.setItem('dt:theme', JSON.stringify({ mode: 'dark', color: '#6d8dff', gradient: false, angle: 135, alpha: 100 })))
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await page.waitForSelector('.sheet', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 1500))
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.sheet')
  const h1 = sheet?.querySelector('h1')
  const p = sheet?.querySelector('p')
  const cs = sheet ? getComputedStyle(sheet) : null
  const atTitle = h1 ? document.elementFromPoint(60, h1.getBoundingClientRect().top + 10) : null
  return {
    sheetBg: cs?.backgroundColor,
    sheetColor: cs?.color,
    opacity: cs?.opacity,
    filter: cs?.filter,
    h1Color: h1 ? getComputedStyle(h1).color : null,
    pColor: p ? getComputedStyle(p).color : null,
    topEl: atTitle ? atTitle.className || atTitle.tagName : null,
    veil: Boolean(document.querySelector('.veil, .overlay, .loading'))
  }
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
