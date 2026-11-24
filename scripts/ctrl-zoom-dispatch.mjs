import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 1200))
const out = await p.evaluate(async () => {
  const ev = (type, key) => document.dispatchEvent(new KeyboardEvent(type, { key, ctrlKey: true, bubbles: true, cancelable: true }))
  const label = () => document.querySelector('#zoom-label').textContent
  const a = label()
  ev('keydown', '=')
  await new Promise(r => setTimeout(r, 400))
  const b = label()
  ev('keydown', '0')
  await new Promise(r => setTimeout(r, 400))
  return { a, b, reset: label() }
})
console.log(JSON.stringify(out))
await b.close()
