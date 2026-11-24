// 验证「主进程焦点桥 → 渲染进程状态机」这一段
// 用法：CDP_PORT=9223 node scripts/electron-state-test.mjs
import puppeteer from 'puppeteer-core'

const PORT = process.env.CDP_PORT || 9222
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
const fails = []
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok   ' + name) }
  else { fails.push(name + (extra ? ' → ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' → ' + extra : '')) }
}

// 页面脚本执行前先装好记录器，才能抓到主进程在 did-finish-load 之后发的事件
await page.evaluateOnNewDocument(() => {
  window.__ws = []
  addEventListener('dt:win-state', (e) => window.__ws.push({ type: 'state', detail: e.detail }))
  addEventListener('dt:win-focus', () => window.__ws.push({ type: 'focus' }))
  addEventListener('dt:win-blur', () => window.__ws.push({ type: 'blur' }))
})
await page.reload({ waitUntil: 'load' })
await sleep(2600)

const s1 = await page.evaluate(() => ({
  ws: window.__ws,
  fm: window.DTFocus?.state,
  ae: document.activeElement?.id || document.activeElement?.tagName,
  hasFocus: document.hasFocus()
}))
console.log('主进程广播：' + JSON.stringify(s1.ws))
console.log('焦点状态机：' + JSON.stringify(s1.fm) + ' activeElement=' + s1.ae)
ok('M1 收到了主进程的 dt:win-state', s1.ws.some((x) => x.type === 'state'), JSON.stringify(s1.ws))
ok('M2 状态机已知窗口激活状态', s1.fm?.known === true, JSON.stringify(s1.fm))

// ---- 负用例：窗口未激活时不制造“假焦点” ----
console.log('\n=== 负用例：dt:win-state{active:false} ===')
await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('dt:win-state', { detail: { active: false } }))
})
await sleep(150)
// 先让焦点离开输入框，再点一个按钮，看它会不会被“抓”回来
await page.evaluate(() => document.activeElement.blur())
await sleep(80)
const btn = await page.evaluate(() => {
  const el = document.querySelector('#btn-web')
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.click(btn.x, btn.y)
await sleep(300)
const s2 = await page.evaluate(() => ({
  fm: window.DTFocus.state,
  ae: document.activeElement?.id || document.activeElement?.tagName
}))
ok('M3 窗口未激活时点按钮不会把焦点塞进输入框', s2.ae !== 'q', 'activeElement=' + s2.ae)
ok('M4 状态机记为未激活', s2.fm.active === false, JSON.stringify(s2.fm))

// ---- 正用例：窗口激活后自动把焦点还给输入框 ----
console.log('\n=== 正用例：dt:win-state{active:true} ===')
await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent('dt:win-state', { detail: { active: true } }))
})
await sleep(300)
const s3 = await page.evaluate(() => ({
  fm: window.DTFocus.state,
  ae: document.activeElement?.id || document.activeElement?.tagName
}))
ok('M5 窗口激活后焦点自动回到输入框', s3.ae === 'q', 'activeElement=' + s3.ae)

// ---- 再次点按钮：这次必须回到输入框 ----
console.log('\n=== 激活后再点按钮 ===')
await page.mouse.click(btn.x, btn.y)
await sleep(300)
const s4 = await page.evaluate(() => ({ ae: document.activeElement?.id || document.activeElement?.tagName }))
ok('M6 激活状态下点按钮焦点回输入框', s4.ae === 'q', 'activeElement=' + s4.ae)

// ---- dt:win-blur / dt:win-focus ----
console.log('\n=== dt:win-blur / dt:win-focus ===')
await page.evaluate(() => window.dispatchEvent(new CustomEvent('dt:win-blur', { detail: {} })))
await sleep(120)
const s5 = await page.evaluate(() => window.DTFocus.state)
ok('M7 dt:win-blur 后记为未激活', s5.active === false, JSON.stringify(s5))
await page.evaluate(() => {
  document.activeElement.blur()
  window.dispatchEvent(new CustomEvent('dt:win-focus', { detail: {} }))
})
await sleep(300)
const s6 = await page.evaluate(() => ({ fm: window.DTFocus.state, ae: document.activeElement?.id || document.activeElement?.tagName }))
ok('M8 dt:win-focus 后焦点回输入框', s6.ae === 'q' && s6.fm.active === true, JSON.stringify(s6))

await page.reload({ waitUntil: 'load' })
await browser.disconnect()

console.log('\n================ 结果 ================')
console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
if (fails.length) { for (const f of fails) console.log('  - ' + f); process.exitCode = 1 }

