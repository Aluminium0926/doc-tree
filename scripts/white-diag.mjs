// 白屏诊断：抓每页画布是否真画出来 + 控制台告警
import puppeteer from 'puppeteer-core'

const DOC = process.argv[2]
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'warning' || m.type() === 'error') logs.push(`[${m.type()}] ${t.slice(0, 220)}`)
})
page.on('pageerror', (e) => logs.push('[pageerror] ' + String(e.message).slice(0, 220)))

await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 4000))

const info = await page.evaluate(() => {
  const pages = [...document.querySelectorAll('.page')].slice(0, 5)
  return pages.map((p) => {
    const c = p.querySelector('canvas')
    const r = p.getBoundingClientRect()
    let alpha = null
    try {
      const d = c.getContext('2d', { willReadFrequently: true }).getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data
      alpha = d[3]
    } catch (e) { alpha = 'err' }
    return { n: p.dataset.page, cw: c.width, ch: c.height, cssW: Math.round(r.width), alpha, top: Math.round(r.top) }
  })
})
console.log(JSON.stringify(info, null, 2))
console.log('日志:', logs.slice(0, 12).join('\n') || '(无)')
await browser.close()
