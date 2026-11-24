import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
const id = await page.evaluate(async () => {
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
await page.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1600))

const res = await page.evaluate(() => {
  const t = document.querySelector('#tree')
  t.scrollTop = t.scrollHeight
  const comp = document.querySelector('#composer').getBoundingClientRect()
  const cards = [...document.querySelectorAll('#tree .node')]
  const last = cards[cards.length - 1]
  const actions = last?.querySelector('.node-actions')
  const lb = last.getBoundingClientRect()
  const ab = actions?.getBoundingClientRect()
  return {
    paddingBottom: getComputedStyle(t).paddingBottom,
    composerTop: Math.round(comp.top),
    lastBottom: Math.round(lb.bottom),
    actionsBottom: ab ? Math.round(ab.bottom) : null,
    gap: ab ? Math.round(comp.top - ab.bottom) : Math.round(comp.top - lb.bottom),
    nodes: cards.length
  }
})
console.log(JSON.stringify(res))
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: 'last-node.png' })
await browser.close()
