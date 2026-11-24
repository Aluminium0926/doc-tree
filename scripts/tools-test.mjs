// 工具条 + 高亮 + 搜索 回归
import puppeteer from 'puppeteer-core'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DOC = process.argv[2]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)))

await page.goto(`http://127.0.0.1:4317/?doc=${DOC}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 1500))

const nav = await page.evaluate(() => ({
  hidden: document.querySelector('#page-nav').hidden,
  total: document.querySelector('#page-total').textContent,
  input: document.querySelector('#page-input').value,
  prevDisabled: document.querySelector('#btn-prev').disabled,
  pageW: Math.round(document.querySelector('.page').getBoundingClientRect().width),
  pageH: Math.round(document.querySelector('.page').getBoundingClientRect().height)
}))
console.log('初始:', JSON.stringify(nav))

await page.click('#btn-next')
await new Promise((r) => setTimeout(r, 500))
console.log('下一页:', await page.evaluate(() => ({
  input: document.querySelector('#page-input').value,
  scrollTop: Math.round(document.querySelector('#page-scroll').scrollTop)
})))

// 旋转
await page.click('#btn-rotate')
await new Promise((r) => setTimeout(r, 1200))
console.log('旋转 90°:', await page.evaluate(() => ({
  w: Math.round(document.querySelector('.page').getBoundingClientRect().width),
  h: Math.round(document.querySelector('.page').getBoundingClientRect().height),
  spans: document.querySelector('.page .textLayer').children.length
})))
for (let i = 0; i < 3; i++) {
  await page.click('#btn-rotate')
  await new Promise((r) => setTimeout(r, 600))
}
await new Promise((r) => setTimeout(r, 800))

// 高亮
await page.click('#btn-hl')
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
await new Promise((r) => setTimeout(r, 900))
console.log('高亮:', await page.evaluate(() => ({
  count: document.querySelectorAll('.hl').length,
  toolbarOn: document.querySelector('#btn-hl').classList.contains('on')
})))
await page.click('#btn-hl')

// 搜索
await page.keyboard.down('Control')
await page.keyboard.press('f')
await page.keyboard.up('Control')
await new Promise((r) => setTimeout(r, 300))
await page.keyboard.type('bone', { delay: 30 })
await new Promise((r) => setTimeout(r, 1200))
console.log('搜索:', await page.evaluate(() => ({
  bar: !document.querySelector('#search-bar').hidden,
  count: document.querySelector('#search-count').textContent,
  hits: document.querySelectorAll('.search-hit').length
})))
await page.screenshot({ path: 'shot-tools.png' })

// 刷新后高亮是否还在
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2500))
console.log('刷新后高亮:', await page.evaluate(() => document.querySelectorAll('.hl').length))
console.log('errors:', errs.length ? errs.join(' | ') : '(无)')
await browser.close()
