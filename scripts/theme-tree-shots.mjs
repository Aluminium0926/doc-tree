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
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
const target = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  for (const d of st.docs) {
    const tree = await (await fetch('/api/tree/' + d.id)).json()
    if (tree.tree && Object.keys(tree.tree.nodes || {}).length) return { id: d.id, nodes: Object.keys(tree.tree.nodes).length }
  }
  return { id: st.docs[0]?.id, nodes: 0 }
})
console.log('doc with tree:', JSON.stringify(target))

await page.goto(`${BASE}/?doc=${target.id}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))

// 浅色
await page.evaluate(() => {
  const cur = window.DTTheme.load()
  window.DTTheme.save({ ...cur, mode: 'light' })
  window.DTTheme.apply({ ...cur, mode: 'light' })
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: 'light-with-tree.png' })

// 手机视口 + 弹层
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await new Promise((r) => setTimeout(r, 700))
await page.click('#btn-theme').catch(() => {})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'mobile-theme.png' })
console.log('errors:', errs.slice(0, 3).join(' | ') || '(无)')
await browser.close()
