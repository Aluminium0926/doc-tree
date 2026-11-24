import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => { localStorage.setItem('dt:seenWelcome','1'); localStorage.setItem('dt:archCollapsed','1') })
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
await p.screenshot({ path: 'group-edit.png', clip: { x: 0, y: 0, width: 250, height: 760 } })
await b.close()
