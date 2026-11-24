// 截图两次确认：框选后不发送，点「发送」才发
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

await page.click('#btn-shot')
await new Promise((r) => setTimeout(r, 300))
const box = await page.evaluate(() => {
  const r = document.querySelector('.page').getBoundingClientRect()
  return { x: r.x, y: r.y }
})
await page.mouse.move(box.x + 120, box.y + 130)
await page.mouse.down()
await page.mouse.move(box.x + 420, box.y + 300, { steps: 10 })
await page.mouse.up()
await new Promise((r) => setTimeout(r, 800))

const staged = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#tree .node').length,
  focus: document.activeElement.id,
  shotChip: !document.querySelector('#shot-chip').hidden,
  status: document.querySelector('#status').textContent
}))
console.log('框选后:', JSON.stringify(staged), '（应无新节点）')

await page.click('#btn-send')
await page.waitForFunction((n) => document.querySelectorAll('#tree .node').length > n, { timeout: 30000 }, before)
await page.waitForFunction(() => !document.querySelector('.answer.streaming'), { timeout: 120000 })
const made = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#tree .node')]
  const last = cards[cards.length - 1]
  return { nodes: cards.length, q: last.querySelector('.node-q').textContent }
})
console.log('点发送后:', JSON.stringify(made))
console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
