// 验证：仅选中时不显示 chip；点「追问」后才出现
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#tree .node .answer')
await new Promise((r) => setTimeout(r, 800))

await page.evaluate(() => {
  const ans = document.querySelector('#tree .node .answer')
  const w = document.createTreeWalker(ans, NodeFilter.SHOW_TEXT)
  let n
  let target = null
  while ((n = w.nextNode())) {
    if (n.textContent.trim().length > 30) {
      target = n
      break
    }
  }
  const r = document.createRange()
  r.setStart(target, 0)
  r.setEnd(target, Math.min(40, target.textContent.length))
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 300))

const before = await page.evaluate(() => {
  const chip = document.querySelector('#anchor-chip')
  return {
    chipDisplay: getComputedStyle(chip).display,
    chipHidden: chip.hidden,
    floatVisible: !document.querySelector('#float-menu').hidden,
    anchorSet: document.querySelector('#anchor-chip .chip-text')?.textContent || ''
  }
})
console.log('选中后:', JSON.stringify(before))
await page.screenshot({ path: 'shot-chip1.png' })

await page.evaluate(() => {
  ;[...document.querySelectorAll('#float-menu button')].find((b) => b.textContent.includes('追问')).click()
})
await new Promise((r) => setTimeout(r, 300))

const after = await page.evaluate(() => {
  const chip = document.querySelector('#anchor-chip')
  return {
    chipDisplay: getComputedStyle(chip).display,
    chipHidden: chip.hidden,
    text: chip.querySelector('.chip-text')?.textContent || '',
    focused: document.activeElement?.id
  }
})
console.log('点追问后:', JSON.stringify(after))
await page.screenshot({ path: 'shot-chip2.png' })

await browser.close()
