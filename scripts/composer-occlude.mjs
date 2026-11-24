import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
const docId = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  for (const d of st.docs) {
    const t = await (await fetch('/api/doc/' + d.id)).json()
    if (Object.keys(t.tree?.nodes || {}).length) return d.id
  }
})
await page.evaluate(() => {
  const c = window.DTTheme.load()
  window.DTTheme.save({ ...c, mode: 'light' })
})
await page.goto(`http://127.0.0.1:4317/?doc=${docId}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1600))
await page.evaluate(() => {
  const t = document.querySelector('#tree')
  t.scrollTop = Math.round(t.scrollHeight * 0.45)
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: 'composer-occlude.png' })

const geom = await page.evaluate(() => {
  const c = document.querySelector('#composer').getBoundingClientRect()
  const l = document.querySelector('#btn-locate')?.getBoundingClientRect()
  return { composer: { top: Math.round(c.top), bottom: Math.round(c.bottom) }, locate: l ? { top: Math.round(l.top), bottom: Math.round(l.bottom) } : null }
})
console.log(JSON.stringify(geom))
await browser.close()
