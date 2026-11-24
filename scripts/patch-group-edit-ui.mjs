import fs from 'node:fs'

const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// ---------- docRow：组内文档加“移出” ----------
t = t.replace(
  `    \${S.selecting ? '' : '<button class="x" title="移出列表（保留提问树）">✕</button>'}\``,
  `    \${S.selecting ? '' : (inGroup ? '<button class="ungroup" title="移出组（提问树留给这份文档）">移出</button>' : '') + '<button class="x" title="移出列表（保留提问树）">✕</button>'}\``
)
t = t.replace(
  `  el.querySelector('.x')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!(await confirmRemove(d.title))) return`,
  `  el.querySelector('.ungroup')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    const g = (S.groups || []).find((x) => x.docIds.includes(d.id))
    if (!g) return
    const r = await fetch('/api/group/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: g.id, remove: [d.id] })
    })
    const j = await r.json().catch(() => ({}))
    await loadState()
    renderLibrary()
    toast(j.dissolved ? '组只剩 1 份，已自动解散，提问树已保留' : \`已把《\${d.title}》移出组\`)
  })
  el.querySelector('.x')?.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!(await confirmRemove(d.title))) return`
)

// ---------- renderLibrary：选择加入模式 + 组行“＋” + 已移除折叠 ----------
t = t.replace(
  `  const groups = S.groups || []
  const groupedIds = new Set(groups.flatMap((g) => g.docIds))
  const rootDocs = visible.filter((d) => !groupedIds.has(d.id))

  for (const g of groups) {`,
  `  const groups = S.groups || []

  // 正在为某个组挑选文档：平铺所有候选（含其他组里的）
  if (S.groupTarget) {
    const g = groups.find((x) => x.id === S.groupTarget)
    const head = document.createElement('div')
    head.className = 'lib-sel-head'
    head.textContent = \`选择要加入「\${g ? g.name : '组'}」的文档\`
    box.appendChild(head)
    for (const d of visible) {
      if (g && g.docIds.includes(d.id)) continue
      box.appendChild(docRow(d, false))
    }
    return
  }

  const groupedIds = new Set(groups.flatMap((g) => g.docIds))
  const rootDocs = visible.filter((d) => !groupedIds.has(d.id))

  for (const g of groups) {`
)

t = t.replace(
  `    row.innerHTML = \`<span class="g-chev">\${open ? '▾' : '▸'}</span><span class="g-name" title="\${esc(g.name)}">\${esc(g.name)}</span><em class="g-count">\${members.length}</em><button class="g-x" title="解散组">✕</button>\`
    row.addEventListener('click', (e) => {
      if (e.target.closest('.g-x')) return`,
  `    row.innerHTML = \`<span class="g-chev">\${open ? '▾' : '▸'}</span><span class="g-name" title="\${esc(g.name)}">\${esc(g.name)}</span><em class="g-count">\${members.length}</em><button class="g-add" title="移入文档">＋</button><button class="g-x" title="解散组">✕</button>\`
    row.addEventListener('click', (e) => {
      if (e.target.closest('.g-x') || e.target.closest('.g-add')) return`
)
t = t.replace(
  `    row.querySelector('.g-x').addEventListener('click', async (e) => {`,
  `    row.querySelector('.g-add').addEventListener('click', (e) => {
      e.stopPropagation()
      startSelecting(g.id)
    })
    row.querySelector('.g-x').addEventListener('click', async (e) => {`
)

// 已移除折叠
t = t.replace(
  `  if (hidden.length) {
    const head = document.createElement('div')
    head.className = 'doc-arch-head'
    head.textContent = \`已移除（\${hidden.length}）\`
    box.appendChild(head)
    for (const d of hidden) {`,
  `  if (hidden.length) {
    const collapsed = localStorage.getItem('dt:archCollapsed') === '1'
    const head = document.createElement('div')
    head.className = 'doc-arch-head'
    head.innerHTML = \`<span>已移除（\${hidden.length}）</span><span class="arch-chev">\${collapsed ? '▸' : '▾'}</span>\`
    head.title = collapsed ? '展开已移除的文档' : '折叠已移除的文档'
    head.addEventListener('click', () => {
      const next = localStorage.getItem('dt:archCollapsed') === '1' ? '0' : '1'
      localStorage.setItem('dt:archCollapsed', next)
      renderLibrary()
    })
    box.appendChild(head)
    for (const d of collapsed ? [] : hidden) {`
)

// ---------- startSelecting / cancel / create：支持目标组 ----------
t = t.replace(
  `function startSelecting() {
  S.selecting = true
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = false
  $('#btn-group')?.classList.add('on')
  updateGroupBar()
  renderLibrary()
}`,
  `function startSelecting(targetId = null) {
  S.selecting = true
  S.groupTarget = targetId || null
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = false
  const nameInput = $('#group-name')
  if (nameInput) nameInput.hidden = Boolean(targetId)
  const createBtn = $('#group-create')
  if (createBtn) createBtn.textContent = targetId ? '加入组' : '创建组'
  $('#btn-group')?.classList.add('on')
  updateGroupBar()
  renderLibrary()
}`
)
t = t.replace(
  `function cancelSelecting() {
  S.selecting = false
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = true
  $('#btn-group')?.classList.remove('on')
  renderLibrary()
}`,
  `function cancelSelecting() {
  S.selecting = false
  S.groupTarget = null
  S.selected = new Set()
  const bar = $('#group-bar')
  if (bar) bar.hidden = true
  const nameInput = $('#group-name')
  if (nameInput) nameInput.hidden = false
  const createBtn = $('#group-create')
  if (createBtn) createBtn.textContent = '创建组'
  $('#btn-group')?.classList.remove('on')
  renderLibrary()
}`
)

t = t.replace(
  `async function createGroupFromSelection() {
  const ids = [...S.selected]
  if (ids.length < 2) return toast('至少选两份文档')
  const name = ($('#group-name')?.value || '').trim() || \`组 \${(S.groups || []).length + 1}\`
  const r = await fetch('/api/group', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, docIds: ids })
  })`,
  `async function createGroupFromSelection() {
  const ids = [...S.selected]
  if (!ids.length) return toast('先选文档')
  const target = S.groupTarget
  if (target) {
    const r = await fetch('/api/group/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: target, add: ids })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return toast(j.error || '加入失败')
    cancelSelecting()
    await loadState()
    renderLibrary()
    toast(j.dissolved ? '组已解散' : \`已加入 \${ids.length} 份文档\`)
    return
  }
  if (ids.length < 2) return toast('至少选两份文档')
  const name = ($('#group-name')?.value || '').trim() || \`组 \${(S.groups || []).length + 1}\`
  const r = await fetch('/api/group', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, docIds: ids })
  })`
)

// 状态字段
t = t.replace(
  "  groups: [],\n  selecting: false,",
  "  groups: [],\n  groupTarget: null,\n  selecting: false,"
)

fs.writeFileSync(F, t)
console.log('group editing ui patched')
