import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 120)}`))

await page.goto('http://127.0.0.1:4500/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))
const reg = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false }
  const r = await navigator.serviceWorker.getRegistration()
  return { supported: true, scope: r?.scope || null, active: Boolean(r?.active) }
})
console.log('sw', JSON.stringify(reg))

await page.evaluate(async () => {
  await navigator.serviceWorker.ready
})
await new Promise((r) => setTimeout(r, 800))

await page.setOfflineMode(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 1200))
const offline = await page.evaluate(() => ({
  title: document.title,
  hasApp: Boolean(document.querySelector('#app')),
  local: Boolean(window.DT_LOCAL)
}))
console.log('offline', JSON.stringify(offline))
console.log('logs', logs.slice(-4).join(' | '))
await browser.close()
