// 二次确认发送：选中不自动发，点「发送」才发；留空用默认问法
import puppeteer from 'puppeteer-core'

const DOC = '67078ceda252'
const BASE = 'http://127.0.0.1:4317'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)))
await page.goto(`${BASE}/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1500))

const before = await page.evaluate(() => document.querySelectorAll('#tree .node').length)

// 选中正文 → 点浮层按钮
await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  const r = document.createRange()
  r.setStart(spans[2].firstChild, 0)
  r.setEnd(spans[4].firstChild, spans[4].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await page.waitForSelector('#float-menu:not([hidden])')
const label = await page.evaluate(() => document.querySelector('#float-menu button').textContent)
await page.click('#float-menu button')
await new Promise((r) => setTimeout(r, 500))

const afterPick = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#tree .node').length,
  focus: document.activeElement.id,
  chip: !document.querySelector('#anchor-chip').hidden,
  chipText: document.querySelector('#anchor-chip .chip-text').textContent
}))
console.log('按钮:', label)
console.log('选中并点击后:', JSON.stringify(afterPick), '（应无新节点）')

// 空输入直接发送
await page.click('#btn-send')
await page.waitForFunction((n) => document.querySelectorAll('#tree .node').length > n, { timeout: 20000 }, before)
await page.waitForFunction(() => !document.querySelector('.answer.streaming'), { timeout: 120000 })
const made = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#tree .node')]
  const last = cards[cards.length - 1]
  return { nodes: cards.length, q: last.querySelector('.node-q').textContent, ans: last.querySelector('.answer').textContent.length }
})
console.log('空输入发送:', JSON.stringify(made))
console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
