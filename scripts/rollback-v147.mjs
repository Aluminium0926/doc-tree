import fs from 'node:fs'

let a = fs.readFileSync('public/app.js', 'utf8')

// 1) 焦点管理回滚：删除 v148+ 的 composerCanFocus/focusComposer/mouseup/heartbeat/modal watcher
const start = a.indexOf('function composerCanFocus()')
if (start < 0) throw new Error('composerCanFocus not found')
const oldFocus = [
  'function autoFocusComposer() {',
  '  if (window.DT_LOCAL) return',
  '  if (document.querySelector(\'.modal:not([hidden])\')) return',
  '  const q = document.querySelector(\'#q\')',
  '  const ae = document.activeElement',
  '  if (!q) return',
  '  if (ae && ae !== q && ae !== document.body && ae.tagName !== \'HTML\') return',
  '  try { q.focus({ preventScroll: true }) } catch {}',
  '}',
  'window.addEventListener(\'focus\', () => setTimeout(autoFocusComposer, 60))',
  'setTimeout(autoFocusComposer, 500)',
  'setTimeout(autoFocusComposer, 1600)',
  '',
  '// caret rescue: if the window focused but the composer lost focus, typing should still go there',
  'document.addEventListener(\'keydown\', (e) => {',
  '  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return',
  '  if (document.querySelector(\'.modal:not([hidden])\')) return',
  '  const ae = document.activeElement',
  '  if (ae && (ae.tagName === \'INPUT\' || ae.tagName === \'TEXTAREA\' || ae.isContentEditable)) return',
  '  if (e.key.length !== 1) return',
  '  const q = document.querySelector(\'#q\')',
  '  if (!q) return',
  '  q.focus({ preventScroll: true })',
  '  q.value += e.key',
  '  e.preventDefault()',
  '})',
  ''
].join('\n')
a = a.slice(0, start) + oldFocus

// 2) openDoc 不再额外 focusComposer
a = a.replace(
  "  if (savedView) restoreViewState(id, savedView, () => { endDocSwitch(); setTimeout(focusComposer, 40) })\n  else requestAnimationFrame(() => requestAnimationFrame(() => { endDocSwitch(); setTimeout(focusComposer, 40) }))",
  "  if (savedView) restoreViewState(id, savedView, endDocSwitch)\n  else requestAnimationFrame(() => requestAnimationFrame(endDocSwitch))"
)

// 3) 发送/继续 finally 不再 focusComposer
a = a.replaceAll("    $('#btn-send').disabled = false\n    $('#btn-stop').hidden = true\n    setTimeout(focusComposer, 0)\n", "    $('#btn-send').disabled = false\n    $('#btn-stop').hidden = true\n")

// 4) updateChip 恢复旧文案
a = a.replace(
  "    const parentNode = a.kind === 'answer' && a.nodeId ? S.tree?.nodes?.[a.nodeId] : null\n    const what = a.quote || parentNode?.question || '整段提问'\n    text.textContent = `${where} · 「${trunc(what, 24)}」`",
  "    text.textContent = `${where} · 「${trunc(a.quote || '整段提问', 24)}」`"
)

// 5) markAnswerSelection 恢复“选中即挂载”
const markStart = a.indexOf('function markAnswerSelection(range, startEl, sel) {')
const floatStart = a.indexOf('/* ================= 浮层 ================= */', markStart)
if (markStart < 0 || floatStart < 0) throw new Error('mark block')
const oldMark = [
  'function markAnswerSelection(range, startEl, sel) {',
  '  const card = startEl.closest(\'.node\')',
  '  if (!card) return hideFloat()',
  '  const parentNode = S.tree?.nodes?.[card.dataset.id]',
  '  S.pendingAnchor = {',
  '    kind: \'answer\',',
  '    nodeId: card.dataset.id,',
  '    quote: sel.toString().trim(),',
  '    page: parentNode?.anchor?.page || currentPage()',
  '  }',
  '  S.pendingParent = card.dataset.id',
  '  updateChip()',
  '  showFloat(range, [{ label: \'追问这段\', primary: true, act: \'ask\' }])',
  '}',
  '',
  ''
].join('\n')
a = a.slice(0, markStart) + oldMark + a.slice(floatStart)

// 6) showFloat 恢复只 focus
a = a.replace(
  "      hideFloat()\n      try { b.run?.() } catch {}\n      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」\n      focusComposer({ end: true })",
  "      hideFloat()\n      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」\n      $('#q').focus()"
)

// 7) 节点 armed 类恢复
a = a.replace("  el.className = 'node' + (S.collapsed.has(n.id) ? ' collapsed' : '') + (S.pendingParent === n.id ? ' armed' : '')", "  el.className = 'node' + (S.collapsed.has(n.id) ? ' collapsed' : '')")

// 8) 追问按钮恢复
a = a.replace(
  "    S.pendingParent = n.id\n    S.pendingAnchor = { kind: 'answer', nodeId: n.id, quote: '', page: n.anchor?.page || currentPage() }\n    updateChip()\n    document.querySelectorAll('.node.armed').forEach((x) => x.classList.remove('armed'))\n    document.querySelector(`.node[data-id=\"${n.id}\"]`)?.classList.add('armed')\n    try { window.getSelection()?.removeAllRanges() } catch {}\n    focusComposer({ end: true })",
  "    S.pendingParent = n.id\n    S.pendingAnchor = { kind: 'answer', nodeId: n.id, quote: '', page: n.anchor?.page || currentPage() }\n    updateChip()\n    $('#q').focus()"
)

// 9) 删除 handler 恢复
a = a.replace(
  "    for (const id of dead) delete S.tree.nodes[id]\n    if (dead.has(S.pendingParent) || (S.pendingAnchor?.nodeId && dead.has(S.pendingAnchor.nodeId))) {\n      S.pendingParent = null\n      S.pendingAnchor = null\n    }\n    renderTree()\n    updateChip()",
  "    for (const id of dead) delete S.tree.nodes[id]\n    renderTree()"
)

fs.writeFileSync('public/app.js', a)

// 10) chem.js：去掉 v151 的空块跳过/空 source 检查
let j = fs.readFileSync('public/chem.js', 'utf8')
j = j.replace("    const parsed = parseBlock(lang, raw)\n    if (!parsed.source) continue\n    const { fig, info } = makeFigure(lang, raw)", "    const { fig, info } = makeFigure(lang, raw)")
j = j.replace("async function moleculeSvg(source, bond = 18) {\n  if (!String(source || '').trim()) throw new Error('没有提供 SMILES')\n  const key = bond + ':' + source", "async function moleculeSvg(source, bond = 18) {\n  const key = bond + ':' + source")
fs.writeFileSync('public/chem.js', j)

// 11) CSS 去掉 armed 高亮
let c = fs.readFileSync('public/style.css', 'utf8')
c = c.replace("\n.node.armed > .node-card { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }\n", "\n")
fs.writeFileSync('public/style.css', c)

// 12) main.cjs：撤掉 native-focus 桥，恢复 q focus
let m = fs.readFileSync('desktop/main.cjs', 'utf8')
m = m.replace(
  '        mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent(\'dt:native-focus\'))")',
  '        mainWindow.webContents.executeJavaScript("document.querySelector(\'#q\')?.focus({preventScroll:true})")'
)
m = m.replace(
  `  mainWindow.on('focus', () => {
    try {
      mainWindow.webContents.focus()
      mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('dt:native-focus'))").catch(() => {})
    } catch {}
  })
  mainWindow.webContents.on('focus', () => {
    try {
      mainWindow.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('dt:native-focus'))").catch(() => {})
    } catch {}
  })`,
  `  mainWindow.on('focus', () => {
    try {
      mainWindow.webContents.focus()
    } catch {}
  })`
)
fs.writeFileSync('desktop/main.cjs', m)

// 13) context 撤掉 v151 的空块提示
let ctx = fs.readFileSync('lib/context.mjs', 'utf8')
ctx = ctx.replace("SMILES 必须能被 RDKit 解析；不确定时宁可只给名称和普通文字，不要输出只有 label 没有结构的空 smiles/reaction 块。", "SMILES 必须能被 RDKit 解析，不确定时宁可只给名称和文字。")
fs.writeFileSync('lib/context.mjs', ctx)

// 14) 版本回 v147 / 1.0.41
a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace("chem.js?v=1.0.45", "chem.js?v=1.0.41")
a = a.replace("const UI_VERSION = 'v151'", "const UI_VERSION = 'v147'")
a = a.replace("const APP_VERSION = '1.0.45'", "const APP_VERSION = '1.0.41'")
fs.writeFileSync('public/app.js', a)
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'))
p.version = '1.0.41'
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n')

console.log('rollback v147 done')
console.log('focusComposer remaining:', (fs.readFileSync('public/app.js', 'utf8').match(/focusComposer/g) || []).length)
console.log('native-focus remaining:', (fs.readFileSync('desktop/main.cjs', 'utf8').match(/native-focus/g) || []).length)
