import puppeteer from 'puppeteer-core'

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900 }
})
const p = await b.newPage()
const logs = []
p.on('console', (m) => logs.push(m.type() + ': ' + m.text().slice(0, 140)))
p.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message.slice(0, 200)))
p.on('response', (r) => {
  if (r.status() >= 400) logs.push('HTTP ' + r.status() + ' ' + r.url())
})

await p.goto('https://aluminium0926.github.io/doc-tree/', { waitUntil: 'networkidle2' })
await p.evaluate(() =>
  localStorage.setItem(
    'dt:config',
    JSON.stringify({ baseUrl: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-flash', effort: 'low' })
  )
)
await p.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 800))
const input = await p.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await new Promise((r) => setTimeout(r, 4000))

const info = await p.evaluate(() => ({
  docs: document.querySelectorAll('.doc-item').length,
  sheet: Boolean(document.querySelector('.sheet')),
  sheetLen: document.querySelector('.sheet')?.innerHTML.length || 0,
  cards: document.querySelectorAll('.code-card').length,
  pres: document.querySelectorAll('pre').length,
  hljs: Boolean(window.hljs),
  bodyText: document.body.innerText.slice(0, 120)
}))
console.log(JSON.stringify(info))
console.log(logs.slice(0, 10).join('\n'))
await b.close()
