import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil:'networkidle2' })
await p.evaluate(()=>{ localStorage.setItem('dt:seenWelcome','1'); for (const m of document.querySelectorAll('.modal')) m.hidden = true; document.querySelector('#btn-stop').hidden = false })
await new Promise(r=>setTimeout(r,300))
const box = await p.evaluate(()=>{ const b=document.querySelector('#btn-stop').getBoundingClientRect(); return { x: Math.round(b.x)-30, y: Math.round(b.y)-30, width: Math.round(b.width)+60, height: Math.round(b.height)+60 } })
await p.screenshot({ path:'stop-icon.png', clip: box })
await b.close()
