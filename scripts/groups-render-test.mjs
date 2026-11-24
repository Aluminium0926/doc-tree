import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
const rows = await p.evaluate(() => [...document.querySelectorAll('.doc-group .g-name')].map(x => x.textContent))
const inGroup = await p.evaluate(() => document.querySelectorAll('.doc-item.in-group').length)
await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const g = st.groups[0]
  document.querySelector(`.doc-item[data-id="${g.docIds[0]}"]`)?.click()
})
await new Promise(r => setTimeout(r, 1800))
const tag = await p.evaluate(() => ({ hidden: document.querySelector('#tree-group').hidden, text: document.querySelector('#tree-group').textContent }))
console.log(JSON.stringify({ rows, inGroup, tag, errs }))
await p.screenshot({ path: 'group-ui.png' })
await b.close()
