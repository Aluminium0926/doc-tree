import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await p.waitForSelector('.page', { timeout: 20000 })
await new Promise(r => setTimeout(r, 1500))
const info = await p.evaluate(() => {
  const pg = document.querySelector('.page').getBoundingClientRect()
  return { x: Math.round(pg.x), y: Math.round(pg.y), w: Math.round(pg.width), h: Math.round(pg.height) }
})
await p.click('#btn-shot')
await new Promise(r => setTimeout(r, 300))
const x1 = info.x + 80, y1 = info.y + 80, x2 = info.x + info.w - 80, y2 = info.y + info.h - 80
await p.mouse.move(x1, y1)
await p.mouse.down()
for (let i = 1; i <= 10; i++) { await p.mouse.move(x1 + (x2-x1)*i/10, y1 + (y2-y1)*i/10); await new Promise(r => setTimeout(r, 20)) }
await p.mouse.up()
await new Promise(r => setTimeout(r, 900))
const out = await p.evaluate(() => {
  const sh = document.querySelector('#shot-chip')
  const th = sh.querySelector('.shot-thumb')
  return { hidden: sh.hidden, chipW: Math.round(sh.getBoundingClientRect().width), thumbW: Math.round(th.getBoundingClientRect().width), style: th.style.width, imgSrc: !!sh.querySelector('img').src }
})
console.log(JSON.stringify({ info, out }))
await b.close()
