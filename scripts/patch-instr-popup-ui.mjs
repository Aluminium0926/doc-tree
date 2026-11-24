import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 弹层逻辑
if (!t.includes('function openInstrPop')) {
  t = t.replace(
    'function resetViewer() {',
    `function closeInstrPop() {
  const pop = $('#instr-pop')
  if (pop) pop.hidden = true
}

function openInstrPop() {
  if (!S.doc) return
  const list = S.doc.instructions || []
  const pop = $('#instr-pop')
  const box = $('#instr-list')
  if (!pop || !box || !list.length) return
  box.innerHTML = ''
  list.forEach((text, i) => {
    const row = document.createElement('div')
    row.className = 'instr-item'
    const span = document.createElement('span')
    span.textContent = text
    const del = document.createElement('button')
    del.title = '删除这条指令'
    del.textContent = '✕'
    del.addEventListener('click', async (e) => {
      e.stopPropagation()
      const r = await fetch('/api/instruction/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docId: S.doc.id, index: i })
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return toast(j.error || '删除失败', 'error')
      S.doc.instructions = j.instructions || []
      renderDocMeta()
      if (S.doc.instructions.length) openInstrPop()
      else closeInstrPop()
    })
    row.append(span, del)
    box.appendChild(row)
  })
  pop.hidden = false
  const r = $('#doc-meta').getBoundingClientRect()
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + 'px'
  pop.style.top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 12) + 'px'
}

async function clearInstructions() {
  if (!S.doc) return
  const r = await fetch('/api/instruction/remove', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId: S.doc.id, clear: true })
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return toast(j.error || '清空失败', 'error')
  S.doc.instructions = []
  renderDocMeta()
  closeInstrPop()
  toast('已清除所有指令')
}

function resetViewer() {`
  )
}

// 绑定
t = t.replace(
  "  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))",
  `  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))
  $('#doc-meta')?.addEventListener('click', (e) => {
    if (e.target.closest('.meta-instr')) {
      e.stopPropagation()
      openInstrPop()
    }
  })
  $('#instr-clear')?.addEventListener('click', clearInstructions)
  document.addEventListener('mousedown', (e) => {
    const pop = $('#instr-pop')
    if (!pop || pop.hidden) return
    if (!pop.contains(e.target) && !e.target.closest('.meta-instr')) closeInstrPop()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInstrPop()
  })`
)
fs.writeFileSync(F, t)

// CSS
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('.instr-pop')) {
  css += `

/* 指令列表弹层 */
.meta-instr { cursor: pointer; }
.instr-pop {
  position: fixed; z-index: 140; width: 280px;
  background: var(--panel-2); border: 1px solid var(--line-2);
  border-radius: 10px; padding: 10px;
  box-shadow: var(--shadow); font-size: 12px;
}
.instr-pop[hidden] { display: none; }
.ip-head { font-size: 11px; color: var(--dim); margin-bottom: 4px; }
.instr-item {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 6px 0; border-top: 1px solid var(--line);
}
.instr-item span { flex: 1; min-width: 0; line-height: 1.55; word-break: break-word; }
.instr-item button {
  border: 0; background: none; color: var(--dim-2); padding: 1px 5px; border-radius: 5px;
}
.instr-item button:hover { color: var(--err); background: var(--panel-3); }
#instr-clear {
  width: 100%; margin-top: 8px; padding: 5px 0; font-size: 11px;
  border-radius: 7px; border: 1px solid var(--line-2); background: transparent; color: var(--dim);
}
#instr-clear:hover { color: var(--err); border-color: var(--err-line); }
`
  fs.writeFileSync('public/style.css', css)
}
console.log('instr popup wired')
