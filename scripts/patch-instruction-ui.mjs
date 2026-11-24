import fs from 'node:fs'

// HTML 按钮
let h = fs.readFileSync('public/index.html', 'utf8')
if (!h.includes('btn-instr')) {
  h = h.replace(
    '        <span id="status"></span>',
    '        <button id="btn-instr" class="ghost instr" title="指令模式：输入什么就发什么，用来改回答方式（不计入提问树）">指令</button>\n        <span id="status"></span>'
  )
  fs.writeFileSync('public/index.html', h)
}

// CSS
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('.instr')) {
  css += `

/* 指令模式按钮 */
#btn-instr {
  font-size: 11px; padding: 3px 9px; border-radius: 999px;
  border: 1px solid var(--line-2); background: transparent; color: var(--dim);
  flex: 0 0 auto;
}
#btn-instr:hover { color: var(--text); border-color: var(--accent); }
#btn-instr.on { color: var(--accent-2); border-color: var(--accent); background: var(--accent-soft); }
`
  fs.writeFileSync('public/style.css', css)
}

// app.js
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace('  groupTarget: null,\n  selecting: false,', '  groupTarget: null,\n  instrMode: false,\n  selecting: false,')

if (!a.includes('function setInstrMode')) {
  a = a.replace(
    'async function send(forced) {',
    `function setInstrMode(on) {
  S.instrMode = Boolean(on)
  const btn = $('#btn-instr')
  if (btn) btn.classList.toggle('on', S.instrMode)
  const q = $('#q')
  if (q) {
    q.placeholder = S.instrMode
      ? '输入指令，例如：以后用英文回答 / 少用公式 / 只讲结论'
      : '选中文字后点「发送」提问，留空也行'
    q.focus()
  }
}

async function sendInstruction(text) {
  if (!S.doc) return toast('先打开一份文档')
  setStatus('指令发送中…')
  try {
    const r = await fetch('/api/instruction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, text })
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || '指令发送失败')
    $('#q').value = ''
    setInstrMode(false)
    toast(j.reply ? \`指令已生效：\${j.reply}\` : '指令已生效')
    await loadState()
    renderLibrary()
  } catch (e) {
    toast(String(e.message || e))
  } finally {
    setStatus('')
  }
}

async function send(forced) {`
  )
}

a = a.replace(
  "  if (S.busy) return\n  let anchor = S.pendingAnchor",
  "  if (S.busy) return\n  if (S.instrMode) {\n    const text = String(forced ?? $('#q').value).trim()\n    if (!text) return toast('先输入一条指令')\n    return sendInstruction(text)\n  }\n  let anchor = S.pendingAnchor"
)

a = a.replace(
  "  $('#btn-shot').addEventListener('click', () => toggleShot())",
  "  $('#btn-shot').addEventListener('click', () => toggleShot())\n  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))"
)
fs.writeFileSync('public/app.js', a)
console.log('instruction ui ok')
