// 验证：框选后松手即自动发送
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2]
const BASE = 'http://127.0.0.1:4317'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(m.text()))
await page.goto(`${BASE}/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1800))

const before = await page.evaluate(() => document.querySelectorAll('#tree .node').length)

await page.click('#btn-shot')
await new Promise((r) => setTimeout(r, 300))
const box = await page.evaluate(() => {
  const r = document.querySelector('.page').getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})

// 拖一个区域
await page.mouse.move(box.x + 120, box.y + 140)
await page.mouse.down()
await page.mouse.move(box.x + 420, box.y + 300, { steps: 10 })
await page.mouse.up()

// 等待自动发送产生新节点
await page.waitForFunction((n) => document.querySelectorAll('#tree .node').length > n, { timeout: 20000 }, before)
await page.waitForFunction(
  () => {
    const cards = [...document.querySelectorAll('#tree .node')]
    const last = cards[cards.length - 1]
    return last && !last.querySelector('.answer.streaming') && (last.querySelector('.answer')?.textContent.length || 0) > 20
  },
  { timeout: 180000 }
)

const after = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#tree .node')]
  const last = cards[cards.length - 1]
  return {
    nodes: cards.length,
    quote: last.querySelector('.quote')?.textContent || '',
    question: last.querySelector('.node-q')?.textContent || '',
    answerLen: last.querySelector('.answer')?.textContent.length || 0,
    textareaEmpty: document.querySelector('#q').value === '',
    shotChipHidden: document.querySelector('#shot-chip').hidden
  }
})
console.log('点前节点数:', before)
console.log('结果:', JSON.stringify(after, null, 2))
console.log('控制台:', logs.filter((l) => l.includes('DocTree')).join(' | '))
await page.screenshot({ path: 'shot-send.png' })

const nodeIds = await page.evaluate(() =>
  [...document.querySelectorAll('#tree .node')].map((n) => n.dataset.id)
)
const lastId = nodeIds[nodeIds.length - 1]
await fetch(`${BASE}/api/node/delete`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ docId: DOC, nodeId: lastId })
})
console.log('已删除测试节点:', lastId)
await browser.close()
