import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil:'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil:'networkidle2' })
await new Promise(r=>setTimeout(r,800))
await p.evaluate(() => {
  for (const m of document.querySelectorAll('.modal')) m.hidden = true
  const t = document.querySelector('#toast')
  t.textContent = '已把《Chapter 7》移出组'
  t.hidden = false
})
await new Promise(r=>setTimeout(r,300))
const box = await p.evaluate(() => { const r = document.querySelector('#toast').getBoundingClientRect(); return { x: Math.round(r.x)-20, y: Math.round(r.y)-20, width: Math.round(r.width)+40, height: Math.round(r.height)+40 } })
await p.screenshot({ path:'toast-ok.png', clip: box })
await b.close()
