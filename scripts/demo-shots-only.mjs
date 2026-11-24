// 只重截图（复用已有数据）
import puppeteer from 'puppeteer-core'

const PORT = process.env.DEMO_PORT || '4421'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = 'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/docs/screenshots'
const [mdId, pdfId] = process.argv.slice(2)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()

await page.goto(`${BASE}/?doc=${mdId}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2500))
await page.screenshot({ path: `${OUT}/reader.png` })
await page.click('#btn-treeview')
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: `${OUT}/tree.png` })

await page.goto(`${BASE}/?doc=${pdfId}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 2200))
await page.click('#btn-hl')
await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  if (!layer) return
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  if (spans.length < 6) return
  const r = document.createRange()
  r.setStart(spans[6].firstChild, 0)
  r.setEnd(spans[9].firstChild, spans[9].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 700))
await page.click('#btn-hl')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}/pdf.png` })

console.log('shots updated')
await browser.close()
