import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await p.waitForSelector('.page', { timeout: 20000 })
await new Promise(r => setTimeout(r, 1500))
const res = await p.evaluate(() => {
  const btn = document.querySelector('#btn-shot')
  btn.click()
  const pg = document.querySelector('.page')
  const r = pg.getBoundingClientRect()
  const x1 = r.left + 80, y1 = r.top + 80, x2 = r.left + r.width - 80, y2 = r.top + r.height - 80
  pg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x1, clientY: y1 }))
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x2, clientY: y2 }))
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x2, clientY: y2 }))
  return new Promise((resolve) => setTimeout(() => {
    const sh = document.querySelector('#shot-chip')
    const th = sh.querySelector('.shot-thumb')
    resolve({
      shotMode: btn.classList.contains('on'),
      hidden: sh.hidden,
      chipW: Math.round(sh.getBoundingClientRect().width),
      thumbW: Math.round(th.getBoundingClientRect().width),
      styleW: th.style.width,
      imgSrc: !!sh.querySelector('img').src
    })
  }, 900))
})
const comp = await p.$('#composer')
await comp.screenshot({ path: 'shot-real.png' })
console.log(JSON.stringify(res))
await b.close()
