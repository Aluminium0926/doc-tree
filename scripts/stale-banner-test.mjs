import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1200, height: 800 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 800))
const normal = await p.evaluate(() => ({ hidden: document.querySelector('#stale').hidden }))

await p.setRequestInterception(true)
p.on('request', (req) => {
  if (req.url().endsWith('/api/state')) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ docs: [], config: {}, serverVersion: '1.0.5' }) })
  }
  req.continue()
})
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
const mismatch = await p.evaluate(() => ({ hidden: document.querySelector('#stale').hidden, text: document.querySelector('#stale-text').textContent.slice(0, 60) }))
await p.screenshot({ path: 'stale-banner.png' })
console.log(JSON.stringify({ normal, mismatch }))
await b.close()
