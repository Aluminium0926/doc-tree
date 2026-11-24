import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil:'networkidle2' })
await p.evaluate(() => {
  localStorage.setItem('dt:seenWelcome','1')
  const t = document.querySelector('#toast')
  t.textContent = '已把《Chapter 7》移出组'
  t.hidden = false
})
await new Promise(r=>setTimeout(r,300))
await p.screenshot({ path:'toast-ok.png', clip:{ x:420, y:40, width:600, height:110 } })
await b.close()
