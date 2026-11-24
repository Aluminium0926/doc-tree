import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4317'
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
  if (m.type() === 'error') errs.push('CERR ' + m.text().slice(0, 160))
})

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
const docId = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  return st.docs.find((d) => d.kind === 'md')?.id || st.docs[0]?.id
})
await page.goto(`${BASE}/?doc=${docId}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.sheet, .page', { timeout: 20000 })
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: 'theme-dark.png' })

const open = async () => {
  await page.click('#btn-theme')
  await new Promise((r) => setTimeout(r, 300))
}
const close = async () => {
  await page.click('#tp-close')
  await new Promise((r) => setTimeout(r, 300))
}

await open()
await page.click('#tp-mode button[data-mode="light"]')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: 'theme-light.png' })

await page.click('#tp-mode button[data-mode="dark"]')
await page.click('#tp-presets button[title="森林"]')
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'theme-green.png' })

await page.click('#tp-grad')
await page.evaluate(() => {
  const a = document.querySelector('#tp-alpha')
  a.value = '82'
  a.dispatchEvent(new Event('input'))
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'theme-glass.png' })
await close()

const info = await page.evaluate(() => ({
  mode: document.documentElement.dataset.mode,
  glass: document.documentElement.dataset.glass,
  bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  appBg: getComputedStyle(document.body).backgroundImage.slice(0, 60)
}))
console.log(JSON.stringify(info))
console.log('errors:', errs.slice(0, 4).join(' | ') || '(无)')
await browser.close()
