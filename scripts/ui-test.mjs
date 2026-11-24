// 浏览器端冒烟：渲染、选区、浮层
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2] || 'b6af4a32e759'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`))

await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.page canvas', { timeout: 30000 }).catch(() => {})
await new Promise((r) => setTimeout(r, 2500))

const info = await page.evaluate(() => ({
  pages: document.querySelectorAll('.page').length,
  rendered: [...document.querySelectorAll('.page canvas')].filter((c) => c.width > 0).length,
  spans: document.querySelectorAll('.textLayer span').length,
  canvasW: document.querySelector('.page canvas')?.width || 0,
  settingsHidden: document.querySelector('#settings').hidden,
  hintHidden: document.querySelector('#hint').hidden,
  scrollH: document.querySelector('#page-scroll')?.scrollHeight || 0,
  firstSpan: document.querySelector('.textLayer span')?.textContent?.slice(0, 40)
}))
console.log('DOM:', JSON.stringify(info, null, 2))
await page.screenshot({ path: 'shot2.png' })

// —— 选区测试 ——
const selInfo = await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  if (!layer) return { error: 'no layer' }
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  if (spans.length < 6) return { error: 'too few spans', n: spans.length }
  const a = spans[2]
  const b = spans[6]
  const r = document.createRange()
  r.setStart(a.firstChild, 0)
  r.setEnd(b.firstChild, b.firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  return { quote: sel.toString().slice(0, 80), menuHidden: document.querySelector('#float-menu').hidden }
})
console.log('selection:', JSON.stringify(selInfo, null, 2))
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: 'shot3.png' })

// 点「追问」，看 chip 是否出现
const chip = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('#float-menu button')].find((b) => b.textContent.includes('追问'))
  if (!btn) return { error: 'no ask button' }
  btn.click()
  return { chipHidden: document.querySelector('#anchor-chip').hidden, chipText: document.querySelector('#anchor-chip .chip-text').textContent }
})
console.log('chip:', JSON.stringify(chip, null, 2))
await page.screenshot({ path: 'shot4.png' })

console.log('\n--- console ---')
console.log(logs.join('\n') || '(无输出)')
await browser.close()
