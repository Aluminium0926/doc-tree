import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
// 打开一个文档（让 S.doc 存在）
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => !d.hidden)?.id })
await p.evaluate((id) => document.querySelector(`.doc-item[data-id="${id}"]`)?.click(), id)
await new Promise(r => setTimeout(r, 1500))
// 点击输入框卡片空白处（不是 input），再直接打字
const r = await p.evaluate(() => { const c = document.querySelector('#composer'); const b = c.getBoundingClientRect(); return { x: b.x + 10, y: b.y + 10 } })
await p.mouse.click(r.x, r.y)
await p.keyboard.type('无焦点输入')
const out = await p.evaluate(() => ({ v: document.querySelector('#q').value, active: document.activeElement?.id }))
console.log(JSON.stringify({ out, errs }))
await b.close()
