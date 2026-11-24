// 验证回答里的公式是否渲染
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
await page.goto(`${BASE}/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('#tree .node .answer')
await new Promise((r) => setTimeout(r, 1200))

const info = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#tree .node').length,
  katex: document.querySelectorAll('#tree .answer .katex').length,
  display: document.querySelectorAll('#tree .answer .katex-display').length,
  sample: document.querySelector('#tree .answer')?.textContent.slice(0, 160)
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'shot-answer-math.png' })
await browser.close()
