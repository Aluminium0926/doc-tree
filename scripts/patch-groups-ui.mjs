import fs from 'node:fs'

// ---------- index.html ----------
let h = fs.readFileSync('public/index.html', 'utf8')
if (!h.includes('id="btn-group"')) {
  h = h.replace(
    '    <div class="lib-tip">支持 PDF / Word / Markdown / TXT</div>',
    '    <div class="lib-tip">支持 PDF / Word / Markdown / TXT</div>\n' +
      '    <div class="group-tools"><button id="btn-group">＋ 建组（多选文档）</button></div>\n' +
      '    <div id="group-bar" hidden>\n' +
      '      <span id="group-bar-count">已选 0 份</span>\n' +
      '      <input id="group-name" placeholder="组名（可选）" maxlength="20">\n' +
      '      <button id="group-create" disabled>创建组</button>\n' +
      '      <button id="group-cancel">取消</button>\n' +
      '    </div>'
  )
  h = h.replace('<span>追问树 <em id="node-count"></em></span>', '<span>追问树 <em id="tree-group" class="tree-group-tag" hidden></em> <em id="node-count"></em></span>')
  fs.writeFileSync('public/index.html', h)
  console.log('html ok')
}

// ---------- CSS ----------
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('doc-group')) {
  css += `

/* ---------- 文档组 ---------- */
.group-tools { padding: 2px 12px 8px; }
#btn-group {
  width: 100%; font-size: 11.5px; padding: 6px 8px; border-radius: 8px;
  border: 1px dashed var(--line-2); background: transparent; color: var(--dim);
}
#btn-group:hover { color: var(--text); border-color: var(--accent); }
#btn-group.on { color: var(--accent-2); border-color: var(--accent); background: var(--accent-soft); }
#group-bar {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  margin: 0 10px 8px; padding: 8px; border-radius: 10px;
  background: var(--panel-2); border: 1px solid var(--line-2);
}
#group-bar[hidden] { display: none; }
#group-bar-count { font-size: 11px; color: var(--dim); }
#group-name {
  flex: 1 1 100%; font: inherit; font-size: 12px; color: var(--text);
  background: var(--panel); border: 1px solid var(--line); border-radius: 7px; padding: 5px 8px; outline: none;
}
#group-create, #group-cancel { font-size: 11.5px; padding: 4px 10px; border-radius: 7px; }
#group-create { background: var(--accent); color: #fff; border: 0; }
#group-create:disabled { opacity: 0.45; }
#group-cancel { background: transparent; border: 1px solid var(--line-2); color: var(--dim); }
.doc-group {
  display: flex; align-items: center; gap: 6px; margin: 4px 8px 2px; padding: 5px 7px;
  border-radius: 8px; cursor: pointer; color: var(--text); font-size: 12px;
}
.doc-group:hover { background: var(--panel-2); }
.doc-group .g-chev { width: 12px; color: var(--dim); font-size: 10px; }
.doc-group .g-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.doc-group .g-count { font-style: normal; font-size: 10.5px; color: var(--dim); }
.doc-group .g-x { border: 0; background: none; color: var(--dim-2); font-size: 11px; padding: 1px 4px; border-radius: 5px; }
.doc-group .g-x:hover { color: var(--warn); background: var(--panel-3); }
.doc-item.in-group { margin-left: 22px; }
.doc-check {
  width: 13px; height: 13px; border-radius: 4px; border: 1px solid var(--line-3);
  display: inline-block; flex: 0 0 auto; position: relative;
}
.doc-check.on { background: var(--accent); border-color: var(--accent); }
.doc-check.on::after {
  content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 7px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.tree-group-tag {
  font-style: normal; font-size: 10.5px; padding: 1px 6px; border-radius: 5px;
  background: var(--accent-soft); color: var(--accent-2); margin-left: 4px;
}
`
  fs.writeFileSync('public/style.css', css)
  console.log('css ok')
}

// ---------- app.js ----------
let a = fs.readFileSync('public/app.js', 'utf8')

a = a.replace(
  'const S = {\n  cfg: null,\n  docs: [],',
  `const S = {
  cfg: null,
  docs: [],
  groups: [],
  selecting: false,
  selected: new Set(),
  collapsedGroups: new Set(JSON.parse(localStorage.getItem('dt:collapsedGroups') || '[]')),`
)

const start = a.indexOf('function renderLibrary() {')
const end = a.indexOf('async function importFiles(files) {')
if (start < 0 || end < 0) throw new Error('renderLibrary markers missing')

const lib = `function docRow(d, inGroup) {
  const el = document.createElement('div')
  const active = S.doc && S.doc.id === d.id
  el.className = 'doc-item' + (active ? ' active' : '') + (inGroup ? ' in-group' : '') + (S.selecting && !inGroup ? ' selecting' : '')
  el.dataset.id = d.id
  const check = S.selecting && !inGroup ? \`<span class="doc-check\${S.selected.has(d.id) ? ' on' : ''}"></span>\` : ''
  el.innerHTML = \`\${check}<span class="doc-ico" data-kind="\${esc(d.kind)}">\${esc((d.kind || '?').toUpperCase())}</span>
    <span class="t" title="\${esc(d.title)}">\${esc(d.title)}</span>
    \${S.selecting ? '' : '<button class="x" title="移出列表（保留提问树）">✕</button>'}\`
  el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return
    if (S.selecting && !inGroup) {
      if (S.selected.has(d.id)) S.selected.delete(d.id)
      else S.selected.add(d.id)
      renderLibrary()
      updateGroupBar()
      return
    }
    openDoc(d.id)
  })
  el.querySelector('.x')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!(await confirmRemove(d.title))) return
    await fetch(\`/api/doc/\${d.id}\`, { method: 'DELETE' })
    if (S.doc && S.doc.id === d.id) resetViewer()
    await loadState()
    renderLibrary()
    toast('已移出列表，重新导入同一文件即可恢复')
  })
  return el
}

function renderLibrary() {
  const box = $('#doc-list')
  box.innerHTML = ''
  const visible = S.docs.filter((d) => !d.hidden)
  const hidden = S.docs.filter((d) => d.hidden)
  if (!visible.length && !hidden.length) {
    box.innerHTML = '<div class="tree-empty">还没有文档</div>'
    return
  }
  const groups = S.groups || []
  const groupedIds = new Set(groups.flatMap((g) => g.docIds))
  const rootDocs = visible.filter((d) => !groupedIds.has(d.id))

  for (const g of groups) {
    const members = g.docIds.map((id) => visible.find((d) => d.id === id)).filter(Boolean)
    if (!members.length) continue
    const open = !S.collapsedGroups.has(g.id)
    const row = document.createElement('div')
    row.className = 'doc-group'
    row.innerHTML = \`<span class="g-chev">\${open ? '▾' : '▸'}</span><span class="g-name" title="\${esc(g.name)}">\${esc(g.name)}</span><em class="g-count">\${members.length}</em><button class="g-x" title="解散组">✕</button>\`
    row.addEventListener('click', (e) => {
      if (e.target.closest('.g-x')) return
      if (S.collapsedGroups.has(g.id)) S.collapsedGroups.delete(g.id)
      else S.collapsedGroups.add(g.id)
      localStorage.setItem('dt:collapsedGroups', JSON.stringify([...S.collapsedGroups]))
      renderLibrary()
    })
    row.querySelector('.g-x').addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm(\`解散「\${g.name}」？\\n提问树会复制给组内每份文档，内容不会丢。\`)) return
      await fetch('/api/group/dissolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.id }) })
      await loadState()
      renderLibrary()
      toast('已解散，提问树已复制到各文档')
    })
    box.appendChild(row)
    if (open) for (const d of members) box.appendChild(docRow(d, true))
  }

  for (const d of rootDocs) box.appendChild(docRow(d, false))

  if (hidden.length) {
    const head = document.createElement('div')
    head.className = 'doc-arch-head'
    head.textContent = \`已移除（\${hidden.length}）\`
    box.appendChild(head)
    for (const d of hidden) {
      const el = document.createElement('div')
      el.className = 'doc-item archived'
      el.dataset.id = d.id
      el.innerHTML = \`<span class="doc-ico" data-kind="\${esc(d.kind)}">\${esc((d.kind || '?').toUpperCase())}</span>
        <span class="t" title="\${esc(d.title)}">\${esc(d.title)}</span>
        <button class="restore" title="恢复到列表">↩</button>
        <button class="x" title="彻底删除（含提问树）">✕</button>\`
      el.querySelector('.restore').addEventListener('click', async (e) => {
        e.stopPropagation()
        await fetch('/api/doc/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
        await loadState()
        renderLibrary()
      })
      el.querySelector('.x').addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!confirm(\`彻底删除《\${d.title}》及其提问树？\\n此操作不可恢复。\`)) return
        await fetch('/api/doc/purge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) })
        await loadState()
        renderLibrary()
      })
      box.appendChild(el)
    }
  }
}

function updateGroupBar() {
  const n = S.selected.size
  const c = $('#group-bar-count')
  if (c) c.textContent = \`已选 \${n} 份\`
  const btn = $('#group-create')
  if (btn) btn.disabled = n < 2
}

function startSelecting() {
  S.selecting = true
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = false
  $('#btn-group')?.classList.add('on')
  updateGroupBar()
  renderLibrary()
}

function cancelSelecting() {
  S.selecting = false
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = true
  $('#btn-group')?.classList.remove('on')
  renderLibrary()
}

async function createGroupFromSelection() {
  const ids = [...S.selected]
  if (ids.length < 2) return toast('至少选两份文档')
  const name = ($('#group-name')?.value || '').trim() || \`组 \${(S.groups || []).length + 1}\`
  const r = await fetch('/api/group', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, docIds: ids })
  })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    return toast(j.error || '创建失败')
  }
  cancelSelecting()
  await loadState()
  renderLibrary()
  toast(\`已创建「\${name}」，组内共享提问树\`)
}

`
a = a.slice(0, start) + lib + a.slice(end)

a = a.replace(
  "  $('#btn-shot').addEventListener('click', () => toggleShot())",
  "  $('#btn-shot').addEventListener('click', () => toggleShot())\n  $('#btn-group')?.addEventListener('click', () => (S.selecting ? cancelSelecting() : startSelecting()))\n  $('#group-create')?.addEventListener('click', createGroupFromSelection)\n  $('#group-cancel')?.addEventListener('click', cancelSelecting)"
)

// 追问树标题显示组名
a = a.replace(
  "function renderTree() {\n  const nodes",
  `function renderTree() {
  const g = (S.groups || []).find((x) => (x.docIds || []).includes(S.doc?.id))
  const tag = $('#tree-group')
  if (tag) {
    tag.hidden = !g
    tag.textContent = g ? g.name : ''
  }
  const nodes`
)

fs.writeFileSync('public/app.js', a)
console.log('app.js ok')
