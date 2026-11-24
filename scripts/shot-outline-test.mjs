import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await p.waitForSelector('.page', { timeout: 20000 })
await new Promise(r => setTimeout(r, 1200))
const info = await p.evaluate(() => {
  document.querySelector('#btn-shot').click()
  const pg = document.querySelector('.page'), r = pg.getBoundingClientRect()
  const x1 = r.left + 80, y1 = r.top + 80, x2 = r.left + r.width - 80, y2 = r.top + r.height - 80
  pg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x1, clientY: y1 }))
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x2, clientY: y2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x2, clientY: y2 }))
  return new Promise((resolve) => setTimeout(() => {
    const sh = document.querySelector('#shot-chip')
    sh.style.outline = '2px solid red'
    const a = document.querySelector('#anchor-chip'); a.style.outline = '2px solid lime'
    const r1 = sh.getBoundingClientRect(), r2 = a.getBoundingClientRect()
    resolve({ shot: { x: Math.round(r1.x), w: Math.round(r1.width), h: Math.round(r1.height), pos: getComputedStyle(sh).position, width: getComputedStyle(sh).width }, anchor: { x: Math.round(r2.x), w: Math.round(r2.width) } })
  }, 900))
})
const comp = await p.$('#composer')
await comp.screenshot({ path: 'shot-outline.png' })
console.log(JSON.stringify(info))
await b.close()
