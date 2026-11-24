import puppeteer from 'puppeteer-core'

const URL = 'https://aluminium0926.github.io/doc-tree/'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 160)))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('CERR ' + m.text().slice(0, 160))
})
await page.goto(URL, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))
const info = await page.evaluate(async () => {
  let sw = null
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    sw = { scope: reg?.scope, active: Boolean(reg?.active) }
  } catch (e) {
    sw = { error: String(e.message) }
  }
  return {
    title: document.title,
    local: window.DT_LOCAL === true,
    shim: window.__DT_SHIM === true,
    hasDrawerBtn: Boolean(document.querySelector('#btn-mobile-lib')),
    manifest: document.querySelector('link[rel=manifest]')?.href,
    sw
  }
})
console.log(JSON.stringify(info, null, 1))
console.log('errors:', errs.slice(0, 4).join(' | ') || '(无)')
await page.screenshot({ path: 'pages-home.png' })
await browser.close()
