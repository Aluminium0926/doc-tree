import puppeteer from 'puppeteer-core'
const base = 'http://127.0.0.1:4317'
const st = await fetch(base + '/api/state').then(r => r.json())
const g = st.groups[0]
if (!g) throw new Error('无组可用于测试')
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message.slice(0, 160)))
await p.goto(base + '/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome', '1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 800))
const before = g.name
await p.evaluate(() => {
  const el = document.querySelector('.doc-group .g-name')
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
})
await new Promise(r => setTimeout(r, 200))
const inputShown = await p.evaluate(() => !!document.querySelector('.g-rename'))
await p.evaluate(() => { const i = document.querySelector('.g-rename'); i.value = '重命名测试'; i.focus() })
await p.keyboard.press('Enter')
await new Promise(r => setTimeout(r, 1000))
const st2 = await fetch(base + '/api/state').then(r => r.json())
const after = st2.groups.find(x => x.id === g.id)?.name
const domName = await p.evaluate(() => document.querySelector('.doc-group .g-name')?.textContent)
console.log(JSON.stringify({ before, inputShown, after, domName, errs }))
await b.close()
