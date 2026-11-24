// 验证左栏收起：布局、PDF 重排、状态持久化
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
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 2000))

const before = await page.evaluate(() => ({
  cols: getComputedStyle(document.querySelector('#app')).gridTemplateColumns,
  canvasW: document.querySelector('.page canvas').width,
  rail: getComputedStyle(document.querySelector('.rail')).display
}))
console.log('展开:', JSON.stringify(before))

await page.click('#btn-collapse')
await new Promise((r) => setTimeout(r, 1200))

const after = await page.evaluate(() => ({
  cols: getComputedStyle(document.querySelector('#app')).gridTemplateColumns,
  canvasW: document.querySelector('.page canvas').width,
  rail: getComputedStyle(document.querySelector('.rail')).display,
  libChildren: [...document.querySelectorAll('#library > *')].map((e) => `${e.className}:${getComputedStyle(e).display}`),
  stored: localStorage.getItem('dt:left')
}))
console.log('收起:', JSON.stringify(after, null, 2))
await page.screenshot({ path: 'shot-collapse.png' })

await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))
const persisted = await page.evaluate(() => ({
  collapsed: document.querySelector('#app').classList.contains('collapsed'),
  cols: getComputedStyle(document.querySelector('#app')).gridTemplateColumns
}))
console.log('刷新后:', JSON.stringify(persisted))

await page.click('#btn-expand')
await new Promise((r) => setTimeout(r, 1200))
const back = await page.evaluate(() => ({
  cols: getComputedStyle(document.querySelector('#app')).gridTemplateColumns,
  canvasW: document.querySelector('.page canvas').width
}))
console.log('展开回来:', JSON.stringify(back))

await browser.close()
