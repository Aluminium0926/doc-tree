import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1638, height: 1048 }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 700))
const out = await page.evaluate(() => {
  const b = (s) => {
    const r = document.querySelector(s).getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  const rz = b('#resizer-right')
  const eff = b('#effort')
  const at = (x, y) => document.elementsFromPoint(x, y).map((e) => e.id || e.className || e.tagName).slice(0, 2)
  return {
    effort: eff,
    resizer: rz,
    sliderHitHeight: eff.h,
    resizerBottom: (rz.y + rz.h),
    atResizerMid: at(rz.x + 4, 500),
    atResizerBottomZone: at(rz.x + 4, eff.y + 10),
    atSliderTrack: at(eff.x + eff.w / 2, eff.y + eff.h / 2)
  }
})
console.log(JSON.stringify(out, null, 1))
await page.screenshot({ path: 'shot-effort.png' })
await browser.close()
