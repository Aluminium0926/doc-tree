// 输入框焦点回归测试（浏览器端，跑本地 4317 服务）
// 用法：node scripts/focus-test.mjs
//      DOC_TREE_URL=http://127.0.0.1:4317/ node scripts/focus-test.mjs
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = process.env.DOC_TREE_URL || 'http://127.0.0.1:4317/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
const fails = []
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok   ' + name) }
  else { fails.push(name + (extra ? ' → ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' → ' + extra : '')) }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--lang=zh-CN'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(URL, { waitUntil: 'load' })
await page.evaluate(() => {
  localStorage.setItem('dt:seenWelcome', '1')
  localStorage.setItem('dt:verCheckOff', '1')
})
await page.reload({ waitUntil: 'load' })
await sleep(2200)

const state = () => page.evaluate(() => {
  const ae = document.activeElement
  const q = document.querySelector('#q')
  const id = (el) => (!el ? null : el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName)
  return {
    ae: id(ae),
    qFocused: ae === q,
    val: q.value,
    caret: [q.selectionStart, q.selectionEnd],
    chip: (() => { const c = document.querySelector('#anchor-chip'); return c ? getComputedStyle(c).display !== 'none' : false })(),
    float: !document.querySelector('#float-menu').hidden,
    modal: [...document.querySelectorAll('.modal:not([hidden])')].map((m) => m.id)
  }
})
const box = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, r: [r.left, r.top, r.right, r.bottom] }
}, sel)
const clickSel = async (sel) => {
  const b = await box(sel)
  if (!b) throw new Error('not found: ' + sel)
  await page.mouse.move(b.x, b.y)
  await sleep(60)
  await page.mouse.click(b.x, b.y)
  await sleep(260)
}
const assertQ = async (name) => {
  const s = await state()
  ok(name, s.qFocused, 'activeElement=' + s.ae)
  return s
}
const hideStale = () => page.evaluate(() => {
  // 开发服务端版本比前端旧时会弹这条横幅，它恰好盖住工具栏按钮，是测试环境的干扰
  const s = document.querySelector('#stale')
  if (s) s.hidden = true
})

console.log('\n=== A. 启动与基础交互 ===')
await assertQ('A1 启动后焦点在输入框')

await page.keyboard.type('abc')
let s = await state()
ok('A2 能直接打字', s.val === 'abc', 'val=' + s.val)
await page.evaluate(() => { document.querySelector('#q').value = '' })

console.log('\n=== B. 打开一份 PDF 文档 ===')
const openedDoc = await page.evaluate(() => {
  const ico = [...document.querySelectorAll('#doc-list .doc-item .doc-ico')].find((x) => x.dataset.kind === 'pdf')
  const item = ico?.closest('.doc-item')
  if (!item) return null
  item.click()
  return item.dataset.id
})
await sleep(2800)
ok('B0 打开了 PDF 文档', Boolean(openedDoc) && (await page.evaluate(() => Boolean(document.querySelector('.page')))))
await assertQ('B1 切换文档后焦点回输入框')
await hideStale() // 开发服务端版本旧时会弹横幅，正好盖住工具栏按钮
const pageNavVisible = await page.evaluate(() => {
  const el = document.querySelector('#page-nav')
  return Boolean(el) && !el.hidden
})

console.log('\n=== C. 点各种按钮之后 ===')
for (const [name, sel] of [
  ['C1 联网', '#btn-web'],
  ['C2 指令', '#btn-instr'],
  ['C3 缩放+', '#btn-zoom-in'],
  ['C4 缩放-', '#btn-zoom-out'],
  ['C5 树状图按钮', '#btn-treeview'],
  ['C6 导出按钮', '#btn-export']
]) {
  await clickSel(sel)
  if (sel === '#btn-treeview') { await clickSel('#tv-close') }
  await assertQ(name)
}
// 收尾：把联网/指令关掉
await clickSel('#btn-web')
await clickSel('#btn-instr')

console.log('\n=== D. 点空白处 ===')
const tree = await box('#tree')
await page.mouse.click(tree.x, tree.r[1] + 20)
await sleep(260)
await assertQ('D1 点追问树空白后')

const viewer = await box('#page-scroll')
await page.mouse.click(viewer.x, viewer.r[1] + 40)
await sleep(260)
await assertQ('D2 点文档区空白后')

console.log('\n=== E. 发送 ===')
await page.evaluate(() => { window.__of = window.fetch; window.fetch = () => Promise.reject(new Error('offline')) })
await clickSel('#btn-send')
await sleep(600)
s = await state()
ok('E1 点「发送」失败后焦点回输入框', s.qFocused, 'activeElement=' + s.ae)
await page.evaluate(() => { window.fetch = window.__of })

console.log('\n=== F. 弹窗 / 面板关闭 ===')
await clickSel('#btn-settings')
ok('F0 设置打开时焦点不在输入框', !(await state()).qFocused)
const cfg = await box('#cfg-base')
await page.mouse.click(cfg.x, cfg.y)
await sleep(150)
ok('F1 设置里的输入框能拿到焦点', (await state()).ae === '#cfg-base')
await page.keyboard.type('x')
ok('F2 设置里能输入', (await page.evaluate(() => document.querySelector('#cfg-base').value)).includes('x'))
await clickSel('#cfg-cancel')
await assertQ('F3 关设置后回输入框')

const hideStale2 = () => page.evaluate(() => {
  const s = document.querySelector('#stale')
  if (s) s.hidden = true
})

await clickSel('#btn-search')
ok('F4 搜索打开时焦点在搜索框', (await state()).ae === '#search-input')
await page.keyboard.press('Escape')
await sleep(300)
await assertQ('F5 Esc 关搜索后回输入框')

await clickSel('#btn-theme')
await clickSel('#tp-close')
await assertQ('F6 关配色弹层后回输入框')

await hideStale()
await clickSel('#btn-search')
ok('F7 点搜索按钮后焦点在搜索框', (await state()).ae === '#search-input')
await page.keyboard.press('Escape')
await sleep(300)
await assertQ('F8 Esc 关搜索后回输入框')

await hideStale()
await page.keyboard.down('Control')
await page.keyboard.press('f')
await page.keyboard.up('Control')
await sleep(300)
ok('F9 Ctrl+F 打开搜索且焦点在搜索框', (await state()).ae === '#search-input')
await page.keyboard.press('Escape')
await sleep(300)
await assertQ('F10 Ctrl+F 后 Esc 回输入框')

console.log('\n=== G. 文本选择不能被破坏 ===')
const hasAnswer = await page.evaluate(() => Boolean(document.querySelector('#tree .node .answer')))
if (hasAnswer) {
  const ab = await page.evaluate(() => {
    const a = document.querySelector('#tree .node .answer')
    a.scrollIntoView({ block: 'center' })
    const r = document.createRange()
    r.selectNodeContents(a)
    const rects = r.getClientRects()
    const rr = rects[0] || a.getBoundingClientRect()
    return { x1: rr.left + 4, y1: rr.top + rr.height / 2, x2: rr.left + Math.min(160, rr.width - 4), y2: rr.top + rr.height / 2 }
  })
  // 真实拖拽选中
  await page.mouse.move(ab.x1, ab.y1)
  await page.mouse.down()
  await page.mouse.move(ab.x2, ab.y2, { steps: 8 })
  await page.mouse.up()
  await sleep(350)
  s = await state()
  ok('G1 拖选文字后焦点不被抢走', s.ae !== '#q', 'activeElement=' + s.ae)
  const selText = await page.evaluate(() => String(window.getSelection() || '').slice(0, 12))
  ok('G2 选区还在', selText.length > 0, JSON.stringify(selText))
  ok('G3 浮层出现', s.float, 'float=' + s.float)
  if (s.float) {
    await clickSel('#float-menu button')
    s = await state()
    ok('G4 点浮层按钮后焦点进输入框', s.qFocused, 'activeElement=' + s.ae)
    ok('G5 锚点 chip 可见', s.chip, 'chip=' + s.chip)
  }
} else {
  console.log('  (skip: 没有回答节点)')
}

console.log('\n=== H. 中文输入法（点按钮之后） ===')
const cdp = await page.createCDPSession()
await page.evaluate(() => {
  const q = document.querySelector('#q')
  q.value = ''
  document.querySelector('#btn-web').focus() // 模拟焦点落到按钮上
})
await clickSel('#btn-web') // 再点一次（切回联网关闭）
await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 229, key: 'Process' })
await cdp.send('Input.imeSetComposition', { text: 'zhongwen', selectionStart: 8, selectionEnd: 8 })
await sleep(120)
await cdp.send('Input.insertText', { text: '中文' })
await sleep(200)
s = await state()
ok('H1 点按钮后中文输入法能落进输入框', s.val === '中文', 'val=' + JSON.stringify(s.val))

console.log('\n=== I. 光标位置不被重置 ===')
await page.evaluate(() => {
  const q = document.querySelector('#q')
  q.value = 'abcdef'
  q.focus()
  q.setSelectionRange(2, 2)
})
await page.keyboard.type('X')
s = await state()
ok('I1 在文本中间输入不会跳到末尾', s.val === 'abXcdef', 'val=' + JSON.stringify(s.val))

console.log('\n=== J. 页码框 / 组名框不被抢（回归） ===')
if (pageNavVisible) {
  const pageInput = await box('#page-input')
  await page.mouse.click(pageInput.x, pageInput.y)
  await sleep(200)
  s = await state()
  ok('J1 点页码框焦点留在页码框', s.ae === '#page-input', 'activeElement=' + s.ae)
  await page.keyboard.type('3')
  const pv = await page.evaluate(() => document.querySelector('#page-input').value)
  ok('J2 页码框能输入', pv.includes('3'), 'value=' + pv)
  await page.keyboard.press('Enter')
  await sleep(300)
  await assertQ('J3 页码框回车后焦点回输入框')
} else {
  console.log('  (skip: 没有 PDF 页码框)')
}

await browser.close()

console.log('\n================ 结果 ================')
console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
if (fails.length) {
  for (const f of fails) console.log('  - ' + f)
  process.exitCode = 1
}
