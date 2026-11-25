// 复现：选中回答文字 → Ctrl+C → 点几下让浮层消失 → 删除这段 → 输入框点不上
import puppeteer from 'puppeteer-core'
const PORT = process.env.CDP_PORT || 9242
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1'))
await page.bringToFront()

const snap = (label) =>
  page.evaluate((l) => {
    const q = document.querySelector('#q')
    const r = q.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    const fm = document.querySelector('#float-menu')
    const chip = document.querySelector('#anchor-chip')
    // 盖住输入框的可交互绝对/固定定位元素
    const cover = [...document.querySelectorAll('body *')].filter((el) => {
      if (el === q || el.contains(q) || q.contains(el)) return false
      const b = el.getBoundingClientRect()
      if (!(b.width > 0 && b.height > 0)) return false
      if (!(b.left < cx && b.right > cx && b.top < cy && b.bottom > cy)) return false
      const cs = getComputedStyle(el)
      return cs.pointerEvents !== 'none' && cs.visibility !== 'hidden' && (cs.position === 'fixed' || cs.position === 'absolute')
    }).slice(0, 6).map((el) => el.id ? '#' + el.id : '.' + String(el.className || '').split(' ')[0])
    return {
      label: l,
      ae: document.activeElement?.id || document.activeElement?.tagName,
      qDisabled: q.disabled,
      qPE: getComputedStyle(q).pointerEvents,
      hitAtComposer: hit ? (hit.id || hit.tagName.toLowerCase() + '.' + String(hit.className || '').split(' ')[0]) : 'null',
      float: fm ? { hidden: fm.hidden, disp: getComputedStyle(fm).display } : null,
      chipHidden: chip?.hidden,
      cover,
      sel: String(window.getSelection() || '').trim().length
    }
  }, label)

console.log(JSON.stringify(await snap('start')))

// 打开第一份文档
const first = await page.evaluate(() => {
  const d = document.querySelector('.doc-item')
  const r = d.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(first.x, first.y)
await sleep(2000)
console.log(JSON.stringify(await snap('after open doc')))

// 找到可见的回答文字块
const box = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('#tree .node')]
  for (const n of nodes) {
    const ans = n.querySelector('.answer')
    if (!ans) continue
    const r = ans.getBoundingClientRect()
    if (r.height < 20) continue
    ans.scrollIntoView({ block: 'center' })
    const r2 = ans.getBoundingClientRect()
    return { x1: r2.left + 10, y1: r2.top + 14, x2: r2.left + Math.min(240, r2.width - 10), y2: r2.top + 14, text: ans.textContent.slice(0, 40) }
  }
  return null
})
console.log('answer target:', JSON.stringify(box))
if (!box) { console.log('没有可测的回答'); await browser.disconnect(); process.exit(0) }

// 1) 拖选
await page.mouse.move(box.x1, box.y1)
await page.mouse.down()
await page.mouse.move(box.x2, box.y2, { steps: 10 })
await page.mouse.up()
await sleep(400)
console.log(JSON.stringify(await snap('after select')))

// 2) Ctrl+C
await page.keyboard.down('Control')
await page.keyboard.press('c')
await page.keyboard.up('Control')
await sleep(300)
console.log(JSON.stringify(await snap('after copy')))

// 3) 左键点几下其他地方（让浮层消失）
for (const p of [{ x: box.x2 + 30, y: box.y2 + 60 }, { x: box.x1 - 20, y: box.y1 - 40 }, { x: box.x1 + 60, y: box.y2 + 120 }]) {
  await page.mouse.click(p.x, p.y)
  await sleep(250)
}
console.log(JSON.stringify(await snap('after clicks')))

// 4) 删除这段：先试键盘 Delete
await page.keyboard.press('Delete')
await sleep(300)
console.log(JSON.stringify(await snap('after Delete key')))

// 4b) 点节点上的“删除”按钮（含 confirm）
page.on('dialog', (d) => d.accept())
const delBtn = await page.evaluate(() => {
  const n = document.querySelector('#tree .node')
  const b = n?.querySelector('[data-act="del"]')
  if (!b) return null
  b.scrollIntoView({ block: 'center' })
  const r = b.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
console.log('del button:', JSON.stringify(delBtn))
if (delBtn) {
  await page.mouse.click(delBtn.x, delBtn.y)
  await sleep(1200)
  console.log(JSON.stringify(await snap('after delete node')))
}

// 5) 点输入框
const qbox = await page.evaluate(() => {
  const r = document.querySelector('#q').getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
await page.mouse.click(qbox.x, qbox.y)
await sleep(400)
console.log(JSON.stringify(await snap('after click composer')))
await page.keyboard.type('abc')
await sleep(300)
console.log(JSON.stringify(await snap('after typing')))
await browser.disconnect()
