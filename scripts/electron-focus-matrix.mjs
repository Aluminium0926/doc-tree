// 真实 Electron 窗口里的 DOM 焦点矩阵（只读，不改数据）
// 用法：node scripts/electron-focus-matrix.mjs
import puppeteer from 'puppeteer-core'

const PORT = process.env.CDP_PORT || 9222
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const read = async (label) => {
  const s = await page.evaluate(() => {
    const idOf = (el) => (!el ? null : el.id ? '#' + el.id : el.tagName)
    const q = document.querySelector('#q')
    const ae = document.activeElement
    return { ae: idOf(ae), q: ae === q, hasFocus: document.hasFocus(), val: q.value }
  })
  console.log(`${label.padEnd(38)} ae=${String(s.ae).padEnd(12)} hasFocus=${s.hasFocus}`)
  return s
}

const click = async (sel) => {
  const box = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  if (!box) { console.log('missing ' + sel); return false }
  await page.mouse.move(box.x, box.y)
  await sleep(80)
  await page.mouse.click(box.x, box.y)
  await sleep(220)
  return true
}

await page.bringToFront()
await sleep(300)
await read('0. 初始')

await click('#q')
await read('1. 点输入框')

await click('#btn-web')
await read('2. 点「联网」按钮')

await page.evaluate(() => window.dispatchEvent(new Event('focus')))
await sleep(220)
await read('3. 派发 window focus（模拟切回窗口）')

await click('#q')
await read('4. 再点输入框')

await click('#btn-zoom-in')
await read('5. 点缩放 +')

if (await click('#btn-instr')) await read('6. 点「指令」按钮')
if (await click('#btn-instr')) await read('6b. 再点「指令」关掉')

// 点追问树空白
const treeBox = await page.evaluate(() => {
  const r = document.querySelector('#tree').getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + 30 }
})
await page.mouse.click(treeBox.x, treeBox.y)
await sleep(220)
await read('7. 点追问树空白')

await page.evaluate(() => window.dispatchEvent(new Event('focus')))
await sleep(220)
await read('8. 派发 window focus（ae=body 时）')

// 真实点击发送按钮（不发请求：先把 fetch 打桩）
await page.evaluate(() => { window.__of = window.fetch; window.fetch = () => Promise.reject(new Error('offline')) })
await click('#btn-send')
await read('9. 点「发送」按钮')
await page.evaluate(() => { window.fetch = window.__of })

await page.evaluate(() => window.dispatchEvent(new Event('focus')))
await sleep(220)
await read('10. 派发 window focus（修复前应仍停在按钮上）')

await browser.disconnect()
