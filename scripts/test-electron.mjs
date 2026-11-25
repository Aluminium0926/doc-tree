// 真实 Electron 验收：CSP / 导航拦截 / 沙箱 / 焦点桥 / PDF 渲染
// 用法：CDP_PORT=9225 node scripts/test-electron.mjs
import puppeteer from 'puppeteer-core'

const PORT = process.env.CDP_PORT || 9225
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1'))
if (!page) {
  console.log('没有找到应用页面:', pages.map((p) => p.url()))
  await browser.disconnect()
  process.exit(1)
}
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))

let pass = 0
const fails = []
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++
    console.log('  ok   ' + name)
  } else {
    fails.push(name + (extra ? ' → ' + extra : ''))
    console.log('  FAIL ' + name + (extra ? ' → ' + extra : ''))
  }
}

const state = () =>
  page.evaluate(() => ({
    url: location.href,
    ver: document.querySelector('#settings-ver')?.textContent || '',
    ae: document.activeElement?.id || document.activeElement?.tagName,
    pages: document.querySelectorAll('.page').length,
    drawn: document.querySelectorAll('.page[data-drawn="1"]').length,
    modules: Boolean(document.querySelector('script[src*="app.js"]'))
  }))

console.log('\n=== Electron 验收 ===')
await page.bringToFront()
await sleep(600)
const s = await state()
ok('页面地址是本地服务', s.url.startsWith('http://127.0.0.1:'), s.url)
ok('前端模块加载', s.modules)
ok('启动后不自动抢焦点（等用户点输入框）', s.ae !== 'q', s.ae)

// CSP：内联脚本应被 script-src 拦住
const inlineRan = await page.evaluate(() => {
  try {
    const s2 = document.createElement('script')
    s2.textContent = 'window.__inlineRan = 1'
    document.body.appendChild(s2)
    s2.remove()
  } catch {}
  return Boolean(window.__inlineRan)
})
ok('CSP 生效（内联脚本被拦）', inlineRan === false, 'inlineRan=' + inlineRan)
consoleErrors.length = 0 // 这条被拦的报错是上面故意触发的，不算真实违规

// RDKit 依赖 eval/wasm：CSP 必须放行，否则化学式全部“SMILES 无法解析”
const rd = await page.evaluate(async () => {
  const t0 = performance.now()
  try {
    if (!window.initRDKitModule) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = '/vendor/rdkit/RDKit_minimal.js'
        s.onload = resolve
        s.onerror = () => reject(new Error('RDKit 脚本加载失败'))
        document.head.appendChild(s)
      })
    }
    const mod = await window.initRDKitModule({ locateFile: (f) => '/vendor/rdkit/' + f })
    const m = mod.get_mol('Nc1ccccc1')
    const valid = Boolean(m && m.is_valid())
    m?.delete?.()
    return { ok: valid, ms: Math.round(performance.now() - t0) }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
})
ok('CSP 下 RDKit 能初始化并解析 SMILES', rd.ok === true, JSON.stringify(rd))
const cspEvalErr = consoleErrors.filter((t) => /unsafe-eval|Refused to evaluate/i.test(t))
ok('没有 eval 相关的 CSP 拦截', cspEvalErr.length === 0, cspEvalErr.slice(0, 2).join(' | '))
consoleErrors.length = 0

// will-navigate：导航到外站应被主进程拦下
const before = page.url()
await page.evaluate(() => {
  location.href = 'https://example.com/blocked-test'
})
await sleep(1500)
const after = page.url()
ok('外站导航被拦截', after === before, before + ' -> ' + after)
ok('页面没被导航走（仍是本地）', after.startsWith('http://127.0.0.1:'), after)

// PDF 渲染（打开列表里第一份 PDF）
const pdfId = await page.evaluate(() => {
  const ico = [...document.querySelectorAll('#doc-list .doc-item .doc-ico')].find((x) => x.dataset.kind === 'pdf')
  return ico ? ico.closest('.doc-item')?.dataset.id : null
})
if (pdfId) {
  await page.evaluate((id) => document.querySelector(`#doc-list .doc-item[data-id="${id}"]`)?.click(), pdfId)
  await sleep(3000)
  const s2 = await state()
  ok('PDF 页框渲染', s2.pages > 0, 'pages=' + s2.pages)
  ok('画布已绘制', s2.drawn > 0, 'drawn=' + s2.drawn)
  ok('打开文档不会自动抢焦点', s2.ae !== 'q', s2.ae)
} else {
  console.log('  (skip: 列表里没有 PDF)')
}

// v170 焦点规则：点按钮不搬焦点；点输入框才聚焦
const click = async (sel) => {
  const b = await page.evaluate((x) => {
    const el = document.querySelector(x)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, sel)
  if (!b) return false
  await page.mouse.move(b.x, b.y)
  await sleep(60)
  await page.mouse.click(b.x, b.y)
  await sleep(250)
  return true
}
await click('#btn-web')
ok('点「联网」后焦点不在输入框', (await state()).ae !== 'q')
{
  const qb = await page.evaluate(() => {
    const r = document.querySelector('#q').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.click(qb.x, qb.y)
  await sleep(250)
  ok('点输入框后焦点在输入框', (await state()).ae === 'q')
  await page.keyboard.type('焦点测试')
  await sleep(200)
  const val = await page.evaluate(() => document.querySelector('#q').value)
  ok('点输入框后可以打字', val.includes('焦点测试'), val)
  await page.evaluate(() => {
    document.querySelector('#q').value = ''
  })
}

const cspErrors = consoleErrors.filter((t) => /Content Security Policy|Refused to/i.test(t))
ok('没有 CSP 违规日志', cspErrors.length === 0, cspErrors.slice(0, 3).join(' | '))
// 网络类资源失败（更新检查连不上 GitHub 等）不算 JS 报错，单独排除
const realErrors = consoleErrors.filter(
  (t) => !/Autofill|DevTools/i.test(t) && !/Failed to load resource|net::ERR_/i.test(t)
)
ok('没有 JS 报错', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.disconnect()
console.log('\n=== 结果 ===')
console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
if (fails.length) {
  for (const f of fails) console.log('  - ' + f)
  process.exitCode = 1
}
