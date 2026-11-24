import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 800))
await p.evaluate(() => {
  const c = document.createElement('canvas')
  c.width = 1600; c.height = 300
  const g = c.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 300)
  g.fillStyle = '#c00'; g.font = 'bold 80px sans-serif'; g.fillText('LEFT SIDE', 20, 170)
  g.fillStyle = '#06c'; g.fillText('RIGHT SIDE', 1200, 170)
  const sh = document.querySelector('#shot-chip')
  sh.hidden = false
  sh.querySelector('img').src = c.toDataURL('image/png')
})
await new Promise(r => setTimeout(r, 700))
const out = await p.evaluate(() => {
  const sh = document.querySelector('#shot-chip').getBoundingClientRect()
  const th = document.querySelector('.shot-thumb').getBoundingClientRect()
  const comp = document.querySelector('#composer').getBoundingClientRect()
  return { chipW: Math.round(sh.width), thumbW: Math.round(th.width), chipRight: Math.round(sh.right), compRight: Math.round(comp.right) }
})
const comp = await p.$('#composer')
await comp.screenshot({ path: 'shot-fit.png' })
console.log(JSON.stringify(out))
await b.close()
