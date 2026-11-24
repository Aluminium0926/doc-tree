import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 300
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 300)
  g.fillStyle = '#c00'; g.font = 'bold 80px sans-serif'; g.fillText('LEFT SIDE', 20, 170)
  const sh = document.querySelector('#shot-chip'); sh.hidden = false; sh.querySelector('img').src = c.toDataURL('image/png')
})
await new Promise(r => setTimeout(r, 600))
const info = await p.evaluate(() => {
  const sh = document.querySelector('#shot-chip')
  const cs = getComputedStyle(sh)
  const parent = getComputedStyle(document.querySelector('#composer'))
  const before = Math.round(sh.getBoundingClientRect().width)
  sh.style.width = 'fit-content'
  const after = Math.round(sh.getBoundingClientRect().width)
  sh.style.width = ''
  return { display: cs.display, width: cs.width, maxWidth: cs.maxWidth, parentDisplay: parent.display, parentAlign: parent.alignItems, before, after }
})
console.log(JSON.stringify(info))
await b.close()
