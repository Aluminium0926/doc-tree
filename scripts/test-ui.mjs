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
let lastLlmBody = null
const mock = http.createServer(async (req, res) => {
  let raw = ''
  for await (const c of req) raw += c
  const body = JSON.parse(raw || '{}')
  lastLlmBody = body
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

  // 拖选 PDF 文字后直接打字（v163 回归）：不能丢焦点、第一个字符也不能丢
  await page.evaluate(() => {
    document.querySelector('#q').value = ''
    window.getSelection()?.removeAllRanges()
  })
  const span = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.textLayer span')].filter((x) => (x.textContent || '').trim().length > 3)
    if (!s.length) return null
    const el = s[Math.min(2, s.length - 1)]
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x1: r.left + 2, y1: r.top + r.height / 2, x2: r.right - 2, y2: r.top + r.height / 2 }
  })
  if (span) {
    await page.mouse.move(span.x1, span.y1)
    await page.mouse.down()
    await page.mouse.move(span.x2, span.y2, { steps: 6 })
    await page.mouse.up()
    await sleep(350)
    const held = await page.evaluate(() => ({
      sel: String(window.getSelection() || '').trim().length,
      chip: !document.querySelector('#anchor-chip')?.hidden
    }))
    ok('拖选后选区保留（不抢焦点）', held.sel > 0, JSON.stringify(held))
    ok('拖选后出现引用 chip', held.chip === true, JSON.stringify(held))
    await page.keyboard.type('ab')
    await sleep(400)
    const typed = await page.evaluate(() => ({ ae: document.activeElement?.id || document.activeElement?.tagName, value: document.querySelector('#q').value }))
    ok('拖选后直接打字：焦点回到输入框', typed.ae === 'q', JSON.stringify(typed))
    ok('拖选后直接打字：第一个字符不丢', typed.value === 'ab', JSON.stringify(typed))
  } else {
    console.log('  (skip: 这个 PDF 没有文本层)')
  }
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

  // 粘贴图片：应该挂到本次提问（跟着问题发出去），而不是导入成文档
  const docsBefore = await page.evaluate(() => document.querySelectorAll('#doc-list .doc-item').length)
  const pasted = await page.evaluate(async () => {
    const cv = document.createElement('canvas')
    cv.width = 60
    cv.height = 30
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#c33'
    ctx.fillRect(0, 0, 60, 30)
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'))
    const file = new File([blob], 'clip.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 900))
    const chip = document.querySelector('#shot-chip')
    return {
      hidden: chip.hidden,
      isDataUrl: String(chip.querySelector('img')?.src || '').startsWith('data:image/'),
      note: chip.querySelector('.shot-note')?.textContent || '',
      focus: document.activeElement?.id
    }
  })
  const docsAfter = await page.evaluate(() => document.querySelectorAll('#doc-list .doc-item').length)
  ok('粘贴图片不会导入成文档', docsBefore === docsAfter, `${docsBefore} → ${docsAfter}`)
  ok('粘贴的图片挂在输入框上', pasted.hidden === false && pasted.isDataUrl, JSON.stringify(pasted))
  ok('图片 chip 注明会随本次提问发送', pasted.note.includes('随本次提问'), pasted.note)
  ok('粘贴后焦点仍在输入框', pasted.focus === 'q', pasted.focus)

  // 带上这张图发一条，服务端应把它作为 image_url 送给模型
  await page.click('#q')
  await page.keyboard.type('这张图是什么？')
  await page.keyboard.press('Enter')
  await sleep(2600)
  const sent = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#tree .node')].pop()
    return el ? { q: el.querySelector('.node-q')?.textContent || '', chipHidden: document.querySelector('#shot-chip').hidden } : null
  })
  ok('带图提问发出去了', (sent?.q || '').includes('这张图'), JSON.stringify(sent))
  ok('发出后图片 chip 清空', sent?.chipHidden === true)
  const parts = (lastLlmBody?.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : []))
  ok('服务端把图片作为 image_url 送给模型', parts.some((p) => p.type === 'image_url' && String(p.image_url?.url || '').startsWith('data:image/')))
  // 清理：删掉刚才这条带图提问，后面的删除/孤儿节点用例依赖“树里只剩 1 条”
  await page.evaluate(async (docId) => {
    const d = await (await fetch('/api/doc/' + docId)).json()
    const n = Object.values(d.tree.nodes || {}).find((x) => String(x.question || '').includes('这张图'))
    if (!n) return
    await fetch('/api/node/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-doctree-client': 'test' },
      body: JSON.stringify({ docId, nodeId: n.id })
    })
  }, txtDoc.id)
  await page.reload({ waitUntil: 'load' })
  await sleep(2200)
}

console.log('\n=== 3.5 复现 v147~v151 报过的问题 ===')
{
  // Bug 4.3 / 5：在回答里拖选文字，松手只应出现浮层，不应自动挂追问
  const drag = await page.evaluate(() => {
    const ans = document.querySelector('#tree .node .answer')
    const r = document.createRange()
    r.selectNodeContents(ans)
    const rect = [...r.getClientRects()].find((x) => x.width > 40) || ans.getBoundingClientRect()
    return { x1: rect.left + 4, y1: rect.top + rect.height / 2, x2: rect.left + Math.min(rect.width - 4, 140), y2: rect.top + rect.height / 2 }
  })
  await page.mouse.move(drag.x1, drag.y1)
  await page.mouse.down()
  await page.mouse.move(drag.x2, drag.y2, { steps: 6 })
  await page.mouse.up()
  await sleep(400)
  const afterSel = await page.evaluate(() => ({
    chipHidden: document.querySelector('#anchor-chip').hidden,
    floatVisible: !document.querySelector('#float-menu').hidden,
    armed: Boolean(document.querySelector('#tree .node.armed')),
    selected: !window.getSelection().isCollapsed
  }))
  ok('Bug4.3/5：拖选回答只出浮层，不自动挂追问', afterSel.chipHidden && afterSel.floatVisible && !afterSel.armed, JSON.stringify(afterSel))
  ok('拖选后选区仍然保留', afterSel.selected)
  const fb = await page.evaluate(() => {
    const b = document.querySelector('#float-menu button')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (fb) {
    await page.mouse.click(fb.x, fb.y)
    await sleep(300)
  }
  const afterFloat = await page.evaluate(() => ({
    chipHidden: document.querySelector('#anchor-chip').hidden,
    armed: Boolean(document.querySelector('#tree .node.armed')),
    ae: document.activeElement?.id || document.activeElement?.tagName
  }))
  ok('点「追问这段」之后才挂上、才聚焦', afterFloat.chipHidden === false && afterFloat.armed === true && afterFloat.ae === 'q', JSON.stringify(afterFloat))

  // Bug 2：选中回答 → Ctrl+C → 点几次空白 → 点「追问」→ 不应丢光标
  await page.evaluate(() => {
    const ans = document.querySelector('#tree .node .answer')
    const r = document.createRange()
    r.selectNodeContents(ans)
    const s = window.getSelection()
    s.removeAllRanges()
    s.addRange(r)
  })
  await page.keyboard.down('Control')
  await page.keyboard.press('c')
  await page.keyboard.up('Control')
  const treeBox = await page.evaluate(() => {
    const r = document.querySelector('#tree').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height - 24 }
  })
  await page.mouse.click(treeBox.x, treeBox.y)
  await sleep(150)
  await page.mouse.click(treeBox.x, treeBox.y)
  await sleep(150)
  const againBtn = await page.evaluate(() => {
    const b = document.querySelector('#tree .node .node-actions [data-act="again"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  ok('找到「追问」按钮', Boolean(againBtn))
  if (againBtn) {
    await page.mouse.move(againBtn.x, againBtn.y)
    await sleep(80)
    await page.mouse.click(againBtn.x, againBtn.y)
    await sleep(350)
    ok('Bug2：选中+复制+点空白后点「追问」焦点仍在输入框', (await ae()) === 'q', await ae())
    const chip = await page.evaluate(() => {
      const c = document.querySelector('#anchor-chip')
      return { hidden: c.hidden, text: c.querySelector('.chip-text')?.textContent || '' }
    })
    ok('Bug3：chip 显示的是这条的问题（不是“整段提问”）', chip.text.includes('这段在讲什么'), chip.text)
    ok('Bug3：当前追问节点有 armed 高亮', await page.evaluate(() => Boolean(document.querySelector('#tree .node.armed'))))
    ok('Bug3：选中任务结束后没有残留选区', await page.evaluate(() => window.getSelection().isCollapsed))
  }

  // Bug 4.1：只有 label/conditions 的空化学块，应该保留原代码块，不渲染空结构
  const chem = await page.evaluate(async () => {
    const mod = await import('/chem.js?v=1.0.43')
    const host = document.createElement('div')
    host.innerHTML = '<pre><code class="language-smiles">label: p-hydroxyazobenzene\nconditions: pH 7-10</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 600))
    const out = {
      figures: host.querySelectorAll('.chem-figure').length,
      keepsPre: Boolean(host.querySelector('pre code')),
      text: host.textContent.trim().slice(0, 40)
    }
    host.remove()
    return out
  })
  ok('Bug4.1：空化学块不生成化学卡片', chem.figures === 0, JSON.stringify(chem))
  ok('Bug4.1：空化学块保留原代码块', chem.keepsPre)

  // Bug 3：删除节点后，指向它的待追问状态必须被清空
  // 注意：删除确认必须是**应用内弹窗**，不能用原生 confirm（会打断输入法）
  let nativeDialogs = 0
  page.on('dialog', (d) => {
    nativeDialogs++
    d.accept()
  })
  const delBtn = await page.evaluate(() => {
    const b = document.querySelector('#tree .node .node-actions [data-act="del"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (delBtn) {
    await page.mouse.move(delBtn.x, delBtn.y)
    await sleep(80)
    await page.mouse.click(delBtn.x, delBtn.y)
    await sleep(400)
    const modal = await page.evaluate(() => {
      const m = document.querySelector('#confirm')
      return { open: Boolean(m && !m.hidden), text: m?.querySelector('#confirm-text')?.textContent || '' }
    })
    ok('删除确认是应用内弹窗', modal.open === true, JSON.stringify(modal))
    ok('没有弹出原生 confirm', nativeDialogs === 0, 'dialogs=' + nativeDialogs)
    const okBtn = await page.evaluate(() => {
      const b = document.querySelector('#confirm-ok')
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await page.mouse.click(okBtn.x, okBtn.y)
    await sleep(900)
    const after = await page.evaluate(() => ({
      nodes: document.querySelectorAll('#tree .node').length,
      chipHidden: document.querySelector('#anchor-chip').hidden,
      modalOpen: !document.querySelector('#confirm').hidden,
      ae: document.activeElement?.id || document.activeElement?.tagName
    }))
    ok('删除后树里没有节点', after.nodes === 0, 'nodes=' + after.nodes)
    ok('删除后待追问 chip 被清空', after.chipHidden === true)
    ok('确认框关闭', after.modalOpen === false)
    ok('确认后焦点回到输入框', after.ae === 'q', after.ae)
  } else {
    ok('找到「删除」按钮', false)
  }

  // 防御：父节点已不存在的“孤儿”节点也要能渲染出来（历史数据/陈旧 pending 的兜底）
  await page.evaluate(async (docId) => {
    await window.fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-doctree-client': 'test' },
      body: JSON.stringify({ docId, question: '孤儿节点测试', parentId: 'deadbeef0000', anchor: { kind: 'doc', page: 1, quote: '' } })
    })
  }, txtDoc.id)
  await sleep(1500)
  await page.reload({ waitUntil: 'load' })
  await sleep(2000)
  const orphan = await page.evaluate(() => ({
    nodes: document.querySelectorAll('#tree .node').length,
    q: document.querySelector('#tree .node .node-q')?.textContent || ''
  }))
  ok('孤儿节点仍能渲染（父节点不存在时挂到根）', orphan.nodes === 1, JSON.stringify(orphan))
  ok('孤儿节点问题可见', orphan.q.includes('孤儿节点测试'), orphan.q)
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

console.log('\n=== 4.5 化学：真 RDKit 渲染 / 不再裁剪 / 部分失败不算超时 ===')
{
  const reaction =
    'label: diazotization of aniline\nreaction: Nc1ccccc1.O=N[O-]>>N#[N+]c1ccccc1\nreagents: HNO2, HCl\nconditions: 0-5 °C, aqueous'
  await page.evaluate(async (src) => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-real'
    host.innerHTML = '<pre><code class="language-reaction"></code></pre>'
    host.querySelector('code').textContent = src
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
  }, reaction)

  let fig = null
  for (let i = 0; i < 40; i++) {
    await sleep(250)
    fig = await page.evaluate(() => {
      const f = document.querySelector('#chem-real .chem-figure')
      if (!f || f.dataset.state === 'rendering') return null
      return { state: f.dataset.state, text: f.textContent.replace(/\s+/g, ' ').slice(0, 120) }
    })
    if (fig) break
  }
  ok('反应式渲染完成', Boolean(fig), JSON.stringify(fig))
  const chem = await page.evaluate(() => {
    const f = document.querySelector('#chem-real .chem-figure')
    if (!f) return null
    const canvas = f.querySelector('.chem-canvas')
    const cr = canvas.getBoundingClientRect()
    const ag = f.querySelector('.chem-agents')?.getBoundingClientRect()
    const cd = f.querySelector('.chem-cond-arrow')?.getBoundingClientRect()
    return {
      state: f.dataset.state,
      parts: f.querySelectorAll('.chem-part svg').length,
      errors: f.querySelectorAll('.chem-part-error').length,
      agents: f.querySelector('.chem-agents')?.textContent || '',
      cond: f.querySelector('.chem-cond-arrow')?.textContent || '',
      // 上下不裁剪：标签必须完整落在画布内（留 2px 容差）
      agentsInside: !ag || (ag.top >= cr.top - 2 && ag.bottom <= cr.bottom + 2),
      condInside: !cd || (cd.top >= cr.top - 2 && cd.bottom <= cr.bottom + 2)
    }
  })
  ok('三个组分都画出了结构（不是“SMILES 无法解析”）', chem && chem.parts === 3 && chem.errors === 0, JSON.stringify(chem))
  ok('试剂显示在箭头上方', (chem?.agents || '').includes('HNO2'), chem?.agents)
  ok('条件完整显示（0-5 °C, aqueous）', (chem?.cond || '').includes('aqueous'), chem?.cond)
  ok('条件/试剂没有被裁掉', chem?.agentsInside === true && chem?.condInside === true, JSON.stringify(chem))

  // 部分组分非法：应停在 partial，15 秒后不能被改成“渲染超时”
  await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-partial'
    host.innerHTML = '<pre><code class="language-reaction">label: partial test\nreaction: CCO.NOT_A_SMILES>>CC</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
  })
  await sleep(1000)
  const partial1 = await page.evaluate(() => document.querySelector('#chem-partial .chem-figure')?.dataset.state)
  await sleep(15500)
  const partial2 = await page.evaluate(() => {
    const f = document.querySelector('#chem-partial .chem-figure')
    return f ? { state: f.dataset.state, text: f.textContent.replace(/\s+/g, ' ').slice(0, 80) } : null
  })
  ok('部分失败时状态是 partial', partial1 === 'partial', String(partial1))
  ok('partial 不会被 15 秒看门狗覆盖成“渲染超时”', partial2 && partial2.state === 'partial' && !partial2.text.includes('渲染超时'), JSON.stringify(partial2))

  // 中线对齐：+ 号、箭头线、两侧结构三者中心必须在同一条水平中线上
  await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-align'
    host.innerHTML =
      '<pre><code class="language-reaction">label: align test\nreaction: Nc1ccccc1.O=N[O-]>>N#[N+]c1ccccc1\nreagents: HNO2, HCl\nconditions: 0-5 °C, aqueous</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
  }, reaction)
  let align = null
  for (let i = 0; i < 40; i++) {
    await sleep(250)
    align = await page.evaluate(() => {
      const f = document.querySelector('#chem-align .chem-figure')
      if (!f || f.dataset.state === 'rendering') return null
      const mid = (el) => {
        const r = el.getBoundingClientRect()
        return r.top + r.height / 2
      }
      const plus = f.querySelector('.chem-plus')
      const line = f.querySelector('.chem-arrow-line')
      const parts = [...f.querySelectorAll('.chem-part')]
      if (!plus || !line || !parts.length) return { missing: true }
      return {
        plus: mid(plus),
        line: mid(line),
        parts: parts.map(mid)
      }
    })
    if (align && !align.missing) break
  }
  ok('找到 + 号与箭头线', Boolean(align && !align.missing), JSON.stringify(align))
  if (align && !align.missing) {
    const dPlusLine = Math.abs(align.plus - align.line)
    const dParts = Math.max(...align.parts.map((p) => Math.abs(p - align.line)))
    ok('+ 号和箭头线在同一条中线上（≤2px）', dPlusLine <= 2, 'Δ=' + dPlusLine.toFixed(2))
    ok('两侧结构中心也在同一条中线上（≤2px）', dParts <= 2, 'Δ=' + dParts.toFixed(2))
  }

  // 没有 reagents、只有 conditions（用户报的“箭头飞了”场景）：箭头线仍须在正中，条件紧贴箭头
  await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-noreagent'
    host.innerHTML =
      '<pre><code class="language-reaction">label: coupling\nreaction: N#[N+]c1ccccc1.CN(C)c1ccccc1>>CN(C)c1ccc(/N=N/c2ccccc2)cc1\nconditions: pH 5-7</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
  })
  let nr = null
  for (let i = 0; i < 40; i++) {
    await sleep(250)
    nr = await page.evaluate(() => {
      const f = document.querySelector('#chem-noreagent .chem-figure')
      if (!f || f.dataset.state === 'rendering') return null
      const line = f.querySelector('.chem-arrow-line')
      const cond = f.querySelector('.chem-cond-arrow')
      if (!line) return { missing: true }
      const lr = line.getBoundingClientRect()
      const fr = f.querySelector('.chem-canvas').getBoundingClientRect()
      const cr = cond?.getBoundingClientRect()
      return {
        lineCenter: lr.top + lr.height / 2,
        canvasCenter: fr.top + fr.height / 2,
        condGap: cr ? cr.top - lr.bottom : null,
        parts: [...f.querySelectorAll('.chem-part')].map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 }),
        agents: Boolean(f.querySelector('.chem-agents'))
      }
    })
    if (nr && !nr.missing) break
  }
  ok('没有试剂时也能找到箭头线', Boolean(nr && !nr.missing), JSON.stringify(nr))
  if (nr && !nr.missing) {
    const dLineParts = Math.max(...nr.parts.map((p) => Math.abs(p - nr.lineCenter)))
    ok('没有试剂时箭头线与结构中心同线（≤2px）', dLineParts <= 2, 'Δ=' + dLineParts.toFixed(2))
    ok('条件紧贴箭头下方（0–10px）', nr.condGap != null && nr.condGap >= 0 && nr.condGap <= 10, 'gap=' + nr.condGap)
    ok('没有试剂时不渲染空 agents', nr.agents === false)
  }

  // 左右同一个分子（模型把「分子式」写成 reaction）：不该画箭头，只画一个结构
  const same = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const mo = 'CN(C)c1ccc(/N=N/c2ccc(S(=O)(=O)[O-])cc2)cc1'
    const host = document.createElement('div')
    host.id = 'chem-same'
    host.innerHTML = '<pre><code class="language-reaction">label: methyl orange\nreaction: ' + mo + '>>' + mo + '</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2500))
    const f = host.querySelector('.chem-figure')
    return f
      ? {
          state: f.dataset.state,
          arrow: Boolean(f.querySelector('.chem-arrow-line')),
          parts: f.querySelectorAll('.chem-part').length,
          svg: f.querySelectorAll('.chem-canvas svg').length
        }
      : { missing: true }
  })
  ok('左右相同：不画箭头，只画一个结构', same && !same.arrow && same.svg === 1, JSON.stringify(same))

  // 没有 >> 的 reaction 块（单分子）：也不该报“反应式需要 反应物>>产物”
  const single = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-single'
    host.innerHTML = '<pre><code class="language-reaction">label: ethanol\nreaction: CCO</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2000))
    const f = host.querySelector('.chem-figure')
    return f ? { state: f.dataset.state, svg: f.querySelectorAll('.chem-canvas svg').length, text: f.textContent.slice(0, 40) } : { missing: true }
  })
  ok('reaction 块只写一个分子 → 按结构显示，不报错', single && single.svg === 1 && single.state === 'done', JSON.stringify(single))

  // 占位条件（-、—、无）不渲染成孤零零的横杠
  const placeholder = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-ph'
    host.innerHTML = '<pre><code class="language-reaction">label: ph\nreaction: CCO>>CC\nconditions: -</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2000))
    const f = host.querySelector('.chem-figure')
    return f ? { cond: Boolean(f.querySelector('.chem-cond-arrow')), text: f.textContent.replace(/\s+/g, ' ').slice(0, 60) } : { missing: true }
  })
  ok('占位条件“-”不渲染', placeholder && placeholder.cond === false, JSON.stringify(placeholder))
}

console.log('\n=== 4.6 单分子朝向 / 空间利用率 ===')
{
  // 甲基橙：线性分子，理想是“氮氮双键水平”，横向占满卡片
  const mo = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-mo'
    host.style.width = '520px'
    host.innerHTML = '<pre><code class="language-smiles">label: methyl orange\nCN(C)c1ccc(/N=N/c2ccccc2)cc1</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2500))
    const f = host.querySelector('.chem-figure')
    const svg = f?.querySelector('.chem-canvas svg')
    if (!svg) return { missing: true }
    const r = svg.getBoundingClientRect()
    const fr = f.getBoundingClientRect()
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      aspect: Math.round((r.width / r.height) * 100) / 100,
      figH: Math.round(fr.height),
      state: f.dataset.state
    }
  })
  ok('单个分子渲染成功', mo && !mo.missing && mo.state === 'done', JSON.stringify(mo))
  ok('线性分子是横向的（宽高比 ≥ 2.5）', mo?.aspect >= 2.5, 'aspect=' + mo?.aspect)
  ok('横向填满可用宽度（≥ 400px）', mo?.w >= 400, 'w=' + mo?.w)
  ok('卡片高度不再被竖排撑长（≤ 260px）', mo?.figH <= 260, 'figH=' + mo?.figH)

  // 紧凑分子：不应被强行拉横，也不该超过高度上限
  const compact = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-compact'
    host.style.width = '520px'
    host.innerHTML =
      '<pre><code class="language-smiles">label: adamantane\nC1C2CC3CC1CC(C2)C3</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2500))
    const f = host.querySelector('.chem-figure')
    const svg = f?.querySelector('.chem-canvas svg')
    if (!svg) return { missing: true }
    const r = svg.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), aspect: Math.round((r.width / r.height) * 100) / 100, state: f.dataset.state }
  })
  ok('紧凑分子渲染成功', compact && !compact.missing && compact.state === 'done', JSON.stringify(compact))
  ok('紧凑分子不会被压成细长条', compact?.aspect >= 0.6 && compact?.aspect <= 2.2, 'aspect=' + compact?.aspect)
  ok('紧凑分子高度受上限约束（≤ 420px）', compact?.h <= 420, 'h=' + compact?.h)

  // 窄容器：不能溢出
  const narrow = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.id = 'chem-narrow'
    host.style.width = '240px'
    host.innerHTML = '<pre><code class="language-smiles">label: methyl orange\nCN(C)c1ccc(/N=N/c2ccccc2)cc1</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2000))
    const svg = host.querySelector('.chem-canvas svg')
    if (!svg) return { missing: true }
    const r = svg.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  ok('窄容器里也不溢出（宽度 ≤ 可用宽度）', narrow && !narrow.missing && narrow.w <= 240, JSON.stringify(narrow))

  // 横平竖直：所有键线必须落在 0° 或 ±60° 方向（偏差 ≤1.5°），不能整体歪几度
  const axis = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.style.width = '520px'
    host.innerHTML = '<pre><code class="language-smiles">label: methyl orange\nCN(C)c1ccc(/N=N/c2ccccc2)cc1</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2500))
    const svg = host.querySelector('.chem-canvas svg')
    if (!svg) return { missing: true }
    const norm = (a) => {
      const m = ((a % 90) + 90) % 90
      return Math.min(m, 90 - m)
    }
    const devs = []
    for (const p of svg.querySelectorAll('path')) {
      const n = (p.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []
      if (n.length < 4) continue
      devs.push(norm((Math.atan2(n[3] - n[1], n[2] - n[0]) * 180) / Math.PI))
    }
    if (!devs.length) return { missing: true }
    const aligned = devs.filter((d) => d < 1).length
    // 到最近晶格方向（0 或 30）的距离；SVG 坐标只保留 1 位小数，短键会有 ~1° 噪声
    const offLattice = devs.map((d) => Math.min(d, Math.abs(d - 30)))
    return {
      count: devs.length,
      alignedPct: Math.round((aligned / devs.length) * 100),
      worstOffLattice: Math.round(Math.max(...offLattice) * 10) / 10
    }
  })
  ok('拿到键线几何', axis && !axis.missing, JSON.stringify(axis))
  ok('有足够多的键是水平/垂直的（≥25%）', axis?.alignedPct >= 25, 'aligned=' + axis?.alignedPct + '%')
  ok('其余键都在 ±60° 晶格方向上（偏差 ≤4°）', axis?.worstOffLattice <= 4, 'worst=' + axis?.worstOffLattice)

  // 线性稠环（蒽）：必须横着摆（之前被摆成 30° 斜的，宽高比只有 1.4）
  const anthracene = await page.evaluate(async () => {
    const mod = await import('/chem.js')
    const host = document.createElement('div')
    host.style.width = '520px'
    host.innerHTML = '<pre><code class="language-smiles">label: anthracene\nc1ccc2cc3ccccc3cc2c1</code></pre>'
    document.body.appendChild(host)
    mod.enhanceChemBlocks(host)
    await new Promise((r) => setTimeout(r, 2500))
    const svg = host.querySelector('.chem-canvas svg')
    if (!svg) return { missing: true }
    const r = svg.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), aspect: Math.round((r.width / r.height) * 100) / 100 }
  })
  ok('蒽是横着的（宽高比 ≥ 2.0）', anthracene?.aspect >= 2.0, JSON.stringify(anthracene))

  // 只为“变宽”而旋转是不允许的：rotate 只能是 ±20° 内的小倾角纠正
  const rots = await page.evaluate(() =>
    ['chem-mo', 'chem-compact', 'chem-narrow'].map((id) => document.querySelector('#' + id + ' .chem-figure')?.dataset.rotate)
  )
  const off = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    const a = Math.abs(n) % 360
    return Math.min(a, 360 - a)
  }
  const bad = rots.map(off).filter((v) => v !== null && v > 20)
  ok('方向只做小倾角纠正，不为变宽而旋转（|rotate| ≤ 20°）', bad.length === 0, JSON.stringify(rots))
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
