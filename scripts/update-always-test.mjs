import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
let hits = 0
await p.setRequestInterception(true)
p.on('request', (req) => {
  if (req.url().startsWith('https://api.github.com/repos/Aluminium0926/doc-tree/releases')) {
    hits++
    return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ tag_name: 'v9.9.9', draft: false, prerelease: false }]) })
  }
  req.continue()
})
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 500))
await p.click('#welcome-ok')
await new Promise(r => setTimeout(r, 1600))
const first = await p.evaluate(() => !document.querySelector('#update').hidden)
await p.click('#update-later')

// 再次启动（刷新）
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 2600))
const second = await p.evaluate(() => !document.querySelector('#update').hidden)

// 静默
await p.evaluate(() => localStorage.setItem('dt:verCheckOff', '1'))
await p.click('#update-later').catch(() => {})
const hitsBefore = hits
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 2400))
const silent = await p.evaluate(() => ({ visible: !document.querySelector('#update').hidden, off: localStorage.getItem('dt:verCheckOff') }))
console.log(JSON.stringify({ first, second, hitsBefore, hitsAfter: hits, silent }))
await b.close()
