import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 220)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
await p.goto('http://127.0.0.1:43171/', { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 1200))
const st = await p.evaluate(() => {
  const q = document.querySelector('#q')
  const r = q?.getBoundingClientRect()
  const at = r ? document.elementFromPoint(r.x + r.width/2, r.y + r.height/2) : null
  const ov = [...document.querySelectorAll('.modal')].filter(m => !m.hidden).map(m => m.id)
  return {
    q: !!q, qDisabled: q?.disabled,
    welcomeHidden: document.querySelector('#welcome')?.hidden,
    settingsHidden: document.querySelector('#settings')?.hidden,
    staleHidden: document.querySelector('#stale')?.hidden,
    openModals: ov,
    hitTag: at?.id || at?.className || at?.tagName,
    qRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    active: document.activeElement?.id
  }
})
await p.click('#q').catch(e => errs.push('click: ' + e.message.slice(0,80)))
await p.keyboard.type('测试输入')
const typed = await p.evaluate(() => ({ v: document.querySelector('#q').value, active: document.activeElement?.id }))
console.log(JSON.stringify({ st, typed, errs }, null, 1))
await p.screenshot({ path: 'live-app.png' })
await b.close()
