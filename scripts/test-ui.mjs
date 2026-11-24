// v153 UI 冒烟测试：独立数据目录 + 假模型 + 本机 Chrome
// 用法：node scripts/test-ui.mjs
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.TEST_UI_PORT || 4321)
const MOCK_PORT = Number(process.env.TEST_UI_MOCK_PORT || 4398)
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DATA = await fsp.mkdtemp(path.join(os.tmpdir(), 'doctree-ui-'))
process.env.DOCTREE_DATA = DATA
process.env.PORT = String(PORT)
process.env.HOST = '127.0.0.1'

const BASE = `http://127.0.0.1:${PORT}`
const CLIENT = { 'x-doctree-client': 'test-suite' }
let pass = 0
const fails = []
function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log('  ok   ' + name)
  } else {
    fails.push(name + (extra ? ' → ' + extra : ''))
    console.log('  FAIL ' + name + (extra ? ' → ' + extra : ''))
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- 假模型 ---------- */
const mock = http.createServer(async (req, res) => {
  let raw = ''
  for await (const c of req) raw += c
  const body = JSON.parse(raw || '{}')
  const lastUser = [...(body.messages || [])].reverse().find((m) => m.role === 'user')
  const text = '## 模拟结论\n\n这是针对「' + String(lastUser?.content || '').slice(-30) + '」的回答。\n\n- 第一条\n- 第二条'
  if (!body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ choices: [{ message: { content: '（模拟摘要）' } }] }))
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  for (const piece of text.match(/[\s\S]{1,8}/g) || []) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
    await sleep(8)
    if (res.destroyed) return
  }
  res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
})
await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r))

/* ---------- 服务端 ---------- */
await fsp.writeFile(path.join(DATA, 'config.json'), JSON.stringify({ baseUrl: `http://127.0.0.1:${MOCK_PORT}`, apiKey: 'sk-test', model: 'mock', pageImage: 'never' }))
await import(pathToFileURL(path.join(ROOT, 'server.mjs')).href)
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${BASE}/api/state`)).ok) break
  } catch {}
  await sleep(100)
}

// 准备两份文档：一份 pdf（验渲染），一份 txt（验提问）
async function upload(filePathDirs, name, bytes) {
  const r = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: { ...CLIENT, 'x-filename': encodeURIComponent(name) },
    body: bytes
  })
  return (await r.json()).doc
}
const pdfPath = path.join(ROOT, 'scripts', 'font-test.pdf')
const pdfDoc = fs.existsSync(pdfPath) ? await upload(null, 'font-test.pdf', await fsp.readFile(pdfPath)) : null
const txtDoc = await upload(null, '冒烟测试.txt', Buffer.from('文档树冒烟测试：本地阅读、划词提问、追问树。\n\n第二段用于搜索命中。'))

/* ---------- 浏览器 ---------- */
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--lang=zh-CN'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text())
})

const ae = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)
const click = async (sel) => {
  const b = await page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, sel)
  if (!b) return false
  await page.mouse.move(b.x, b.y)
  await sleep(60)
  await page.mouse.click(b.x, b.y)
  await sleep(260)
  return true
}

await page.goto(`${BASE}/`, { waitUntil: 'load' })
await page.evaluate(() => {
  localStorage.setItem('dt:seenWelcome', '1')
  localStorage.setItem('dt:verCheckOff', '1')
})
await page.reload({ waitUntil: 'load' })
await sleep(2000)

console.log('\n=== 1. 加载 / 版本 ===')
{
  const pkg = JSON.parse(await fsp.readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const js = await (await fetch(`${BASE}/app.js`)).text()
  ok('UI_VERSION 与 APP_VERSION 一致', js.includes(`const APP_VERSION = '${pkg.version}'`), pkg.version)
  const st = await (await fetch(`${BASE}/api/state`)).json()
  ok('服务端版本一致', st.serverVersion === pkg.version, st.serverVersion)
  ok('页面没有 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  ok('模块化：app.js 引用了 modules/', js.includes("./modules/util.js") && js.includes("./modules/api.js"))
  ok('焦点管理器已加载', await page.evaluate(() => Boolean(window.DTFocus)))
  ok('启动后焦点在输入框', (await ae()) === 'q', await ae())
}

console.log('\n=== 2. 文档渲染 ===')
if (pdfDoc) {
  await page.evaluate((id) => window.openDocForTest?.(id), pdfDoc.id)
  // openDoc 不在 window 上，改为点文档列表
  await page.evaluate((id) => {
    const row = document.querySelector(`#doc-list .doc-item[data-id="${id}"]`)
    row?.click()
  }, pdfDoc.id)
  await sleep(2500)
  const pages = await page.evaluate(() => document.querySelectorAll('.page').length)
  ok('PDF 页框已渲染', pages > 0, 'pages=' + pages)
  const drawn = await page.evaluate(() => document.querySelectorAll('.page[data-drawn="1"]').length)
  ok('至少一页画布已绘制', drawn > 0, 'drawn=' + drawn)
} else {
  console.log('  (skip: 没有 font-test.pdf)')
}
{
  await page.evaluate((id) => {
    const row = document.querySelector(`#doc-list .doc-item[data-id="${id}"]`)
    row?.click()
  }, txtDoc.id)
  await sleep(1200)
  const hasSheet = await page.evaluate(() => Boolean(document.querySelector('#sheet')))
  ok('txt 文档渲染成 sheet', hasSheet)
  ok('切换文档后焦点回输入框', (await ae()) === 'q', await ae())
}

console.log('\n=== 3. 提问（真 UI + 假模型） ===')
{
  await page.click('#q')
  await page.keyboard.type('这段在讲什么？')
  await page.keyboard.press('Enter')
  await sleep(300)
  ok('发送后焦点仍在输入框', (await ae()) === 'q', await ae())
  await sleep(2500)
  const node = await page.evaluate(() => {
    const el = document.querySelector('#tree .node')
    return el ? { q: el.querySelector('.node-q')?.textContent, a: el.querySelector('.answer')?.textContent || '', count: document.querySelectorAll('#tree .node').length } : null
  })
  ok('树里出现节点', Boolean(node), JSON.stringify(node))
  ok('节点显示问题', (node?.q || '').includes('这段在讲什么'), node?.q)
  ok('回答有内容', (node?.a || '').length > 5, node?.a)
  ok('节点计数更新', (node?.count || 0) === 1, 'count=' + node?.count)
  ok('发送后输入框已清空', (await page.evaluate(() => document.querySelector('#q').value)) === '')
}

console.log('\n=== 4. Markdown / 外链 / 代码块 ===')
{
  const res = await page.evaluate(async () => {
    const mod = await import('/modules/markdown.js')
    const html = mod.renderMarkdown('[来源](https://example.com/x) 和 `code` 和 $x^2$')
    const d = document.createElement('div')
    d.innerHTML = html
    const a = d.querySelector('a')
    return { html, target: a?.getAttribute('target'), rel: a?.getAttribute('rel'), katex: Boolean(d.querySelector('.katex')) }
  })
  ok('外链加了 target=_blank', res.target === '_blank', JSON.stringify(res.target))
  ok('外链加了 rel=noopener', (res.rel || '').includes('noopener'), res.rel)
  ok('KaTeX 仍然渲染', res.katex, res.html.slice(0, 120))
}

console.log('\n=== 5. 搜索 / 高亮层不吃点击 ===')
{
  await page.keyboard.down('Control')
  await page.keyboard.press('f')
  await page.keyboard.up('Control')
  await sleep(300)
  ok('Ctrl+F 打开搜索并聚焦', (await ae()) === 'search-input', await ae())
  await page.keyboard.type('第二段')
  await sleep(500)
  const hits = await page.evaluate(() => document.querySelectorAll('.search-hit').length)
  ok('搜索命中并画出高亮', hits > 0, 'hits=' + hits)
  const pe = await page.evaluate(() => {
    const el = document.querySelector('.search-hit')
    return el ? getComputedStyle(el).pointerEvents : null
  })
  ok('高亮层 pointer-events:none（不挡选中文字）', pe === 'none', pe)
  await page.keyboard.press('Escape')
  await sleep(300)
  ok('Esc 关搜索后焦点回输入框', (await ae()) === 'q', await ae())
}

console.log('\n=== 6. 输入框自增高 ===')
{
  const h = await page.evaluate(() => {
    const q = document.querySelector('#q')
    q.value = '这是一段很长的问题。'.repeat(30)
    q.dispatchEvent(new Event('input', { bubbles: true }))
    return q.getBoundingClientRect().height
  })
  ok('长文本时输入框变高', h > 60, 'height=' + h)
  await page.evaluate(() => {
    const q = document.querySelector('#q')
    q.value = ''
    q.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

console.log('\n=== 7. 点击后焦点（回归） ===')
{
  for (const [name, sel] of [
    ['点「联网」', '#btn-web'],
    ['点「缩放+」', '#btn-zoom-in'],
    ['点「导出」', '#btn-export']
  ]) {
    const hit = await click(sel)
    if (!hit) {
      ok(name + ' 后焦点仍在输入框', false, '按钮不存在')
      continue
    }
    ok(name + ' 后焦点仍在输入框', (await ae()) === 'q', await ae())
  }
  await click('#btn-web') // 关掉联网
  const treeBox = await page.evaluate(() => {
    const r = document.querySelector('#tree').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + 20 }
  })
  await page.mouse.click(treeBox.x, treeBox.y)
  await sleep(300)
  ok('点追问树空白后焦点回输入框', (await ae()) === 'q', await ae())
}

console.log('\n=== 8. 设置弹窗 ===')
{
  await click('#btn-settings')
  await sleep(200)
  ok('设置打开', await page.evaluate(() => !document.querySelector('#settings').hidden))
  await click('#cfg-cancel')
  await sleep(300)
  ok('关设置后焦点回输入框', (await ae()) === 'q', await ae())
}

await browser.close()
mock.close()

console.log('\n=== 结果 ===')
ok('全程没有 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '))
console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
if (fails.length) {
  for (const f of fails) console.log('  - ' + f)
  process.exitCode = 1
}
await fsp.rm(DATA, { recursive: true, force: true }).catch(() => {})
setTimeout(() => process.exit(process.exitCode || 0), 200)
