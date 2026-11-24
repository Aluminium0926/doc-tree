import fs from 'node:fs'

// HTML：停止按钮
let h = fs.readFileSync('public/index.html', 'utf8')
if (!h.includes('btn-stop')) {
  h = h.replace(
    '        <button id="btn-send" title="发送（回车）">',
    '        <button id="btn-stop" class="stop-btn" hidden title="停止生成">■</button>\n        <button id="btn-send" title="发送（回车）">'
  )
  fs.writeFileSync('public/index.html', h)
}

// CSS
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('.stop-btn')) {
  css += `

/* 停止生成 */
.stop-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: 0; background: var(--accent); color: #fff;
  display: grid; place-items: center; font-size: 9px; line-height: 1;
  flex: 0 0 auto;
}
.stop-btn:hover { filter: brightness(1.08); }
`
  fs.writeFileSync('public/style.css', css)
}

// app.js
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace('  instrMode: false,', '  instrMode: false,\n  abort: null,')

a = a.replace(
  `  S.busy = true
  $('#btn-send').disabled = true
  setStatus('思考中…')

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, parentId, anchor, question: q, image })
    })`,
  `  S.busy = true
  $('#btn-send').disabled = true
  $('#btn-stop').hidden = false
  setStatus('思考中…')
  const ac = new AbortController()
  S.abort = ac

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: S.doc.id, parentId, anchor, question: q, image }),
      signal: ac.signal
    })`
)

a = a.replace(
  `  } catch (e) {
    toast(e.message)
    setStatus('')
  } finally {
    S.busy = false
    $('#btn-send').disabled = false
  }`,
  `  } catch (e) {
    if (e && e.name === 'AbortError') setStatus('已停止')
    else {
      toast(e.message)
      setStatus('')
    }
  } finally {
    S.abort = null
    S.busy = false
    $('#btn-send').disabled = false
    $('#btn-stop').hidden = true
  }`
)

// SSE：工具状态
a = a.replace(
  "    } else if (ev.type === 'error') {",
  `    } else if (ev.type === 'tool') {
      const args = ev.args || {}
      const label =
        ev.name === 'read_page'
          ? \`正在读第 \${args.page} 页…\`
          : ev.name === 'search_docs'
            ? \`正在检索「\${args.query || ''}」…\`
            : '正在查看文档…'
      setStatus(label)
    } else if (ev.type === 'stopped') {
      setStatus('已停止')
    } else if (ev.type === 'error') {`
)

// 停止按钮绑定
a = a.replace(
  "  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))",
  "  $('#btn-instr')?.addEventListener('click', () => setInstrMode(!S.instrMode))\n  $('#btn-stop')?.addEventListener('click', () => {\n    if (S.abort) S.abort.abort()\n  })"
)
fs.writeFileSync('public/app.js', a)
console.log('stop + tool status wired')
