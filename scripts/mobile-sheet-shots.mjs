import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()

async function shot(mode, file) {
  await page.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
  await page.evaluate(
    (m) => localStorage.setItem('dt:theme', JSON.stringify({ mode: m, color: '#6d8dff', gradient: false, angle: 135, alpha: 100 })),
    mode
  )
  await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 500))
  const input = await page.$('#file-input')
  await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
  await page.waitForSelector('.code-card', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 900))
  await page.screenshot({ path: file })
}

await shot('light', 'm-light-sheet.png')
await shot('dark', 'm-dark-sheet.png')
console.log('done')
await browser.close()
