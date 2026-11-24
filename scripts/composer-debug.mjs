import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
const state = await p.evaluate(() => ({
  q: !!document.querySelector('#q'),
  qDisabled: document.querySelector('#q')?.disabled,
  qValue: document.querySelector('#q')?.value,
  banner: document.querySelector('#stale') ? !document.querySelector('#stale').hidden : null,
  bannerText: document.querySelector('#stale-text')?.textContent?.slice(0,60),
  groupBar: document.querySelector('#group-bar') ? !document.querySelector('#group-bar').hidden : null,
  active: document.activeElement?.id
}))
await p.click('#q')
await p.keyboard.type('测试输入')
const after = await p.evaluate(() => ({ v: document.querySelector('#q').value, active: document.activeElement?.id }))
console.log(JSON.stringify({ state, after, errs }, null, 1))
await p.screenshot({ path: 'composer.png' })
await b.close()
