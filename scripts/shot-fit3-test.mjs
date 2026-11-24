import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
const out = await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 300
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 300)
  g.fillStyle = '#c00'; g.font = 'bold 80px sans-serif'; g.fillText('LEFT SIDE', 20, 170)
  const sh = document.querySelector('#shot-chip'); sh.hidden = false
  const img = sh.querySelector('img'); const thumb = sh.querySelector('.shot-thumb')
  img.src = c.toDataURL('image/png')
  return new Promise((resolve) => setTimeout(() => {
    const nw = img.naturalWidth, nh = img.naturalHeight
    const dispW = nw * Math.min(1, 64 / nh)
    thumb.style.width = Math.min(280, Math.round(dispW)) + 'px'
    const after = Math.round(sh.getBoundingClientRect().width)
    resolve({ nw, nh, dispW, thumbW: Math.round(thumb.getBoundingClientRect().width), chipAfter: after })
  }, 400))
})
const comp = await p.$('#composer')
await comp.screenshot({ path: 'shot-fit3.png' })
console.log(JSON.stringify(out))
await b.close()
