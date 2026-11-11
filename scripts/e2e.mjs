// 端到端：导入 → 划词讲解 → 在回答里继续追问 → 校验树结构
import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'http://127.0.0.1:4317'
const DOC = process.argv[2]
const CFG = new URL('../data/config.json', import.meta.url)
const backup = fs.existsSync(CFG) ? fs.readFileSync(CFG, 'utf8') : null

const setCfg = (baseUrl, model, apiKey) =>
  fetch(`${BASE}/api/config`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseUrl, model, apiKey })
  }).then((r) => r.json())

await setCfg('http://127.0.0.1:4318/v1', 'mock', 'mock')

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const logs = []
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(`[console] ${m.text()}`)
})

await page.goto(`${BASE}/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1200))

const rendered = await page.evaluate(
  () => [...document.querySelectorAll('.page canvas')].filter((c) => c.width > 0).length
)
console.log('渲染页数（懒加载后）:', rendered)

// 1) 划词 → 讲解
await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  const r = document.createRange()
  r.setStart(spans[2].firstChild, 0)
  r.setEnd(spans[5].firstChild, spans[5].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await page.waitForSelector('#float-menu:not([hidden])')
await page.evaluate(() => {
  ;[...document.querySelectorAll('#float-menu button')].find((b) => b.textContent === '讲解').click()
})
await page.waitForFunction(() => document.querySelectorAll('#tree .node').length >= 1, { timeout: 20000 })
await page.waitForFunction(() => document.querySelectorAll('.answer.streaming').length === 0, { timeout: 40000 })
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'shot5.png' })

// 2) 在回答里划词 → 追问
await page.evaluate(() => {
  const ans = document.querySelector('#tree .node .answer')
  const p = ans.querySelector('p') || ans
  const r = document.createRange()
  r.selectNodeContents(p)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await page.waitForSelector('#float-menu:not([hidden])')
await page.evaluate(() => {
  ;[...document.querySelectorAll('#float-menu button')].find((b) => b.textContent.includes('追问')).click()
})
const chip = await page.evaluate(() => document.querySelector('#anchor-chip .chip-text')?.textContent || '')
await page.evaluate(() => {
  document.querySelector('#q').value = '第三层具体指什么？'
})
await page.click('#btn-send')
await page.waitForFunction(() => document.querySelectorAll('#tree .node').length >= 2, { timeout: 20000 })
await page.waitForFunction(() => document.querySelectorAll('.answer.streaming').length === 0, { timeout: 40000 })
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: 'shot6.png' })

const tree = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#tree .node').length,
  depth1: document.querySelectorAll('#tree .node[data-depth="1"]').length,
  hasChildren: Boolean(document.querySelector('#tree .node .children .node')),
  quotes: [...document.querySelectorAll('#tree .quote')].map((e) => e.textContent.slice(0, 24))
}))
console.log('chip:', chip)
console.log('树:', JSON.stringify(tree, null, 2))
console.log('errors:', logs.join('\n') || '(无)')

await browser.close()

// 收尾：还原配置、清掉测试文档
if (backup) fs.writeFileSync(CFG, backup, 'utf8')
else await setCfg('https://api.deepseek.com/v1', 'deepseek-flash', '')
await fetch(`${BASE}/api/doc/${DOC}`, { method: 'DELETE' })
console.log('已还原配置并删除测试文档')
