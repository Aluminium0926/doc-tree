import puppeteer from 'puppeteer-core'

const res = await fetch('http://127.0.0.1:9333/json/list')
const [target] = await res.json()
const browser = await puppeteer.connect({ browserWSEndpoint: target.webSocketDebuggerUrl, defaultViewport: null })
const pages = await browser.pages()
const page = pages[pages.length - 1]

await page.waitForSelector('#q')
const box = await page.evaluate(() => {
  const r = document.querySelector('#q').getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
await page.mouse.click(box.x + 40, box.y + 18)
await page.keyboard.type('abc')
await new Promise((r) => setTimeout(r, 200))

const state = await page.evaluate(() => {
  const q = document.querySelector('#q')
  const cs = getComputedStyle(q)
  return {
    active: document.activeElement.id || document.activeElement.tagName,
    hasFocus: document.hasFocus(),
    value: q.value,
    caretColor: cs.caretColor,
    color: cs.color,
    opacity: cs.opacity,
    visibility: cs.visibility,
    caretWidth: cs.caretWidth
  }
})
console.log('state', JSON.stringify(state))

// 连拍 3 张，看竖线有没有出现
for (let i = 0; i < 3; i++) {
  await page.screenshot({ path: `caret-${i}.png`, clip: { x: box.x - 6, y: box.y - 6, width: 260, height: box.h + 12 } })
  await new Promise((r) => setTimeout(r, 280))
}
console.log('shots done')
await browser.disconnect()
