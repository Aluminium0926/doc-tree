import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => { localStorage.removeItem('dt:seenWelcome'); localStorage.removeItem('dt:flags') })
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
const first = await p.evaluate(() => ({
  visible: !document.querySelector('#welcome').hidden,
  start: !document.querySelector('#welcome-start').hidden,
  choices: [...document.querySelectorAll('.welcome-choice strong')].map(x => x.textContent)
}))
await p.screenshot({ path: 'welcome-new.png' })
await p.click('#welcome-newbie')
await new Promise(r => setTimeout(r, 200))
const guide = await p.evaluate(() => ({
  guide: !document.querySelector('#welcome-guide').hidden,
  steps: document.querySelectorAll('.welcome-steps li').length,
  links: [...document.querySelectorAll('.welcome-steps a')].map(a => a.href)
}))
await p.screenshot({ path: 'welcome-guide.png' })
await p.click('#welcome-guide-done')
await new Promise(r => setTimeout(r, 500))
const after = await p.evaluate(() => ({
  welcomeHidden: document.querySelector('#welcome').hidden,
  settingsOpen: !document.querySelector('#settings').hidden,
  focus: document.activeElement?.id
}))
const flagsApi = await (await fetch('http://127.0.0.1:4317/api/state')).json()
// 只清 localStorage，验证服务端 flag 仍能阻止重复弹窗
await p.evaluate(() => localStorage.removeItem('dt:seenWelcome'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
const second = await p.evaluate(() => !document.querySelector('#welcome').hidden)
console.log(JSON.stringify({ first, guide, after, flags: flagsApi.flags, secondLaunchVisible: second, errs }, null, 1))
await b.close()
