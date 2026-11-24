// 验证：回答里划词点「追问这段」直接发送，不需要打字
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
await page.waitForSelector('#tree .node .answer')
await new Promise((r) => setTimeout(r, 1200))

const before = await page.evaluate(() => document.querySelectorAll('#tree .node').length)

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
  r.setEnd(target, Math.min(50, target.textContent.length))
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await page.waitForSelector('#float-menu:not([hidden])')
const menu = await page.evaluate(() => [...document.querySelectorAll('#float-menu button')].map((b) => b.textContent))
console.log('浮层按钮:', menu)

await page.evaluate(() => {
  ;[...document.querySelectorAll('#float-menu button')].find((b) => b.textContent.includes('追问')).click()
})

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
    depth: last.dataset.depth,
    question: last.querySelector('.node-q')?.textContent || '',
    quote: last.querySelector('.quote')?.textContent || '',
    answerLen: last.querySelector('.answer')?.textContent.length || 0,
    textareaEmpty: document.querySelector('#q').value === ''
  }
})
console.log('结果:', JSON.stringify(after, null, 2))
console.log('版本:', logs.filter((l) => l.includes('DocTree')).join(' | '))
await page.screenshot({ path: 'shot-ask.png' })

const ids = await page.evaluate(() => [...document.querySelectorAll('#tree .node')].map((n) => n.dataset.id))
await fetch(`${BASE}/api/node/delete`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ docId: DOC, nodeId: ids[ids.length - 1] })
})
console.log('已删除测试节点')
await browser.close()
