import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("function focusComposer() {\n  if (!composerCanFocus()) return false\n  const q = document.querySelector('#q')\n  if (!q) return false\n  try {\n    q.focus({ preventScroll: true })\n    return document.activeElement === q\n  } catch {\n    return false\n  }\n}", `function focusComposer({ end = false } = {}) {
  if (!composerCanFocus()) return false
  const q = document.querySelector('#q')
  if (!q) return false
  try {
    q.focus({ preventScroll: true })
    if (end) {
      const n = q.value.length
      q.setSelectionRange(n, n)
    }
    return document.activeElement === q
  } catch {
    return false
  }
}`)
// follow-up button: collapse selection and put caret at end
a=a.replace("    updateChip()\n    $('#q').focus()\n  })", "    updateChip()\n    try { window.getSelection()?.removeAllRanges() } catch {}\n    focusComposer({ end: true })\n  })")
// mouseup catch-all, before modal watcher
if(!a.includes("// mouseup focus guard")){
  a += `
// mouseup focus guard: clicking buttons/doc items always returns the caret;
// text selection without an explicit button is left alone.
document.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return
  const explicit = e.target.closest('button, .doc-item')
  if (explicit) {
    try { window.getSelection()?.removeAllRanges() } catch {}
  }
  setTimeout(() => {
    if (explicit) {
      focusComposer({ end: true })
      return
    }
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return
    if (e.target.closest('input, textarea, select, [contenteditable], #search-bar')) return
    focusComposer()
  }, 60)
}, true)
`
  fs.writeFileSync('public/app.js',a)
}
console.log('mouseup guard/followup', a.includes('mouseup focus guard'), a.includes('focusComposer({ end: true })'))
