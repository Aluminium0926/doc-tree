// 验证可拖动分栏：右侧追问树 / 左侧文件列表
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
await new Promise((r) => setTimeout(r, 1800))

const snap = () =>
  page.evaluate(() => ({
    cols: getComputedStyle(document.querySelector('#app')).gridTemplateColumns,
    canvasW: document.querySelector('.page canvas').width,
    leftw: localStorage.getItem('dt:leftw'),
    rightw: localStorage.getItem('dt:rightw')
  }))

console.log('初始:', JSON.stringify(await snap()))

// 拖右边界：向左 130px → 右栏变宽
const r1 = await page.evaluate(() => {
  const b = document.querySelector('#resizer-right').getBoundingClientRect()
  return { x: b.x + b.width / 2, y: 400 }
})
await page.mouse.move(r1.x, r1.y)
await page.mouse.down()
await page.mouse.move(r1.x - 130, r1.y, { steps: 12 })
await page.mouse.up()
await new Promise((r) => setTimeout(r, 900))
console.log('右栏 +130:', JSON.stringify(await snap()))

// 拖左边界：向右 60px → 左栏变宽
const r2 = await page.evaluate(() => {
  const b = document.querySelector('#resizer-left').getBoundingClientRect()
  return { x: b.x + b.width / 2, y: 400 }
})
await page.mouse.move(r2.x, r2.y)
await page.mouse.down()
await page.mouse.move(r2.x + 60, r2.y, { steps: 10 })
await page.mouse.up()
await new Promise((r) => setTimeout(r, 900))
console.log('左栏 +60:', JSON.stringify(await snap()))

await page.screenshot({ path: 'shot-resize.png' })

// 刷新后是否保持
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1600))
console.log('刷新后:', JSON.stringify(await snap()))

// 双击复位
const r3 = await page.evaluate(() => {
  const b = document.querySelector('#resizer-right').getBoundingClientRect()
  return { x: b.x + b.width / 2, y: 400 }
})
await page.mouse.click(r3.x, r3.y, { clickCount: 2 })
await new Promise((r) => setTimeout(r, 700))
console.log('双击复位:', JSON.stringify(await snap()))

await browser.close()
