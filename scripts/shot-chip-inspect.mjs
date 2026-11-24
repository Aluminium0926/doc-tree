import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
const id = await p.evaluate(async () => { const st = await (await fetch('/api/state')).json(); return st.docs.find(d => d.kind === 'pdf')?.id })
await p.goto('http://127.0.0.1:4317/?doc=' + id, { waitUntil: 'networkidle2' })
await p.waitForSelector('.page', { timeout: 20000 })
await new Promise(r => setTimeout(r, 1500))
await p.click('#btn-shot')
await new Promise(r => setTimeout(r, 400))
await p.mouse.move(500, 300)
await p.mouse.down()
await p.mouse.move(760, 760, { steps: 12 })
await p.mouse.up()
await new Promise(r => setTimeout(r, 900))
const out = await p.evaluate(() => {
  const sh = document.querySelector('#shot-chip')
  const img = sh.querySelector('img')
  const c = document.querySelector('#composer').getBoundingClientRect()
  const r = img?.getBoundingClientRect()
  const cs = img ? getComputedStyle(img) : null
  return {
    hidden: sh.hidden,
    html: sh.innerHTML.slice(0, 200),
    img: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    composer: { x: Math.round(c.x), right: Math.round(c.right), y: Math.round(c.y), h: Math.round(c.height) },
    style: cs ? { maxH: cs.maxHeight, maxW: cs.maxWidth, objectFit: cs.objectFit } : null
  }
})
console.log(JSON.stringify(out, null, 1))
await p.screenshot({ path: 'shot-chip.png' })
await b.close()
