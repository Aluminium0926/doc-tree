import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.filter(d => d.kind === 'pdf').sort((a,b)=>b.pages-a.pages)[0]?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await p.waitForSelector('.page', { timeout: 20000 })
await new Promise(r => setTimeout(r, 1500))
// 滚到中间
await p.evaluate(() => {
  const el = document.querySelectorAll('.page')[40]
  el.scrollIntoView({ block: 'center' })
})
await new Promise(r => setTimeout(r, 2000))
const state1 = await p.evaluate(() => {
  const root = document.querySelector('#page-scroll').getBoundingClientRect()
  const vis = [...document.querySelectorAll('.page')].filter(el => {
    const r = el.getBoundingClientRect(); return r.bottom > root.top && r.top < root.bottom
  })
  return vis.map(el => ({ p: el.dataset.page, drawn: el.dataset.drawn, w: el.querySelector('canvas').width }))
})
// 模拟一张空白页：清空 canvas + 标记未画
await p.evaluate(() => {
  const el = document.querySelectorAll('.page')[42]
  const c = el.querySelector('canvas')
  c.getContext('2d').clearRect(0, 0, c.width, c.height)
  el.dataset.drawn = '0'
  el.scrollIntoView({ block: 'center' })
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 1800))
const healed = await p.evaluate(() => {
  const el = document.querySelectorAll('.page')[42]
  const c = el.querySelector('canvas')
  const px = c.getContext('2d').getImageData(Math.floor(c.width/2), Math.floor(c.height/2), 1, 1).data
  return { drawn: el.dataset.drawn, alpha: px[3], w: c.width }
})
console.log(JSON.stringify({ visible: state1, healed, errs }, null, 1))
await b.close()
