import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.setRequestInterception(true)
p.on('request', (req) => {
  if (req.url().endsWith('/api/state')) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ docs: [], config: {}, serverVersion: '1.0.5' }) })
  }
  req.continue()
})
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 800))
const st = await p.evaluate(() => { const el = document.querySelector('#stale'); const r = el.getBoundingClientRect(); return { hidden: el.hidden, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) } })
await p.click('#q')
await p.keyboard.type('还能输入')
const typed = await p.evaluate(() => document.querySelector('#q').value)
console.log(JSON.stringify({ st, typed }))
await p.screenshot({ path: 'stale-top.png' })
await b.close()
