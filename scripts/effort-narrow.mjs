import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1638, height: 1048 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 800))

async function probe(label) {
  const out = await page.evaluate(() => {
    const b = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const eff = document.querySelector('#effort').getBoundingClientRect()
    const y = eff.y + eff.height / 2
    const stackAt = (x) => document.elementsFromPoint(x, y).map((e) => e.id || e.className || e.tagName).slice(0, 2)
    return {
      sidebar: b('#sidebar'),
      resizer: b('#resizer-right'),
      effort: b('#effort'),
      left: stackAt(eff.x + 1),
      mid: stackAt(eff.x + eff.width / 2),
      right: stackAt(eff.x + eff.width - 1),
      gap: stackAt(eff.x - 6)
    }
  })
  console.log(label, JSON.stringify(out))
  return out
}

await probe('默认宽度')

// 拖窄侧栏：抓住 resizer 往右拖到最小
const r = await page.evaluate(() => {
  const el = document.querySelector('#resizer-right').getBoundingClientRect()
  return { x: el.x + el.width / 2, y: 400 }
})
await page.mouse.move(r.x, r.y)
await page.mouse.down()
await page.mouse.move(r.x + 300, r.y, { steps: 10 })
await page.mouse.up()
await new Promise((x) => setTimeout(x, 300))
await probe('拖窄后')

// 再拖到最窄
const r2 = await page.evaluate(() => {
  const el = document.querySelector('#resizer-right').getBoundingClientRect()
  return { x: el.x + el.width / 2, y: 400 }
})
await page.mouse.move(r2.x, r2.y)
await page.mouse.down()
await page.mouse.move(r2.x + 400, r2.y, { steps: 10 })
await page.mouse.up()
await new Promise((x) => setTimeout(x, 300))
await probe('最窄后')

await page.screenshot({ path: 'shot-narrow.png' })
await browser.close()
