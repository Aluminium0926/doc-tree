import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/tmp-inline.md')
await page.waitForSelector('.sheet code', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 900))

async function shot(file) {
  const box = await page.evaluate(() => {
    const s = document.querySelector('.sheet')
    const r = s.getBoundingClientRect()
    return { x: r.x + 20, y: r.y + 90, width: Math.min(760, r.width - 40), height: 200 }
  })
  await page.screenshot({ path: file, clip: box })
}

await shot('inline-dark.png')
await page.evaluate(() => {
  const c = window.DTTheme.load()
  window.DTTheme.save({ ...c, mode: 'light' })
  window.DTTheme.apply({ ...c, mode: 'light' })
})
await new Promise((r) => setTimeout(r, 500))
await shot('inline-light.png')
await browser.close()
console.log('done')
