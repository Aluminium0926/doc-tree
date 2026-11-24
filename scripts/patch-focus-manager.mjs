import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
const old=`function autoFocusComposer() {
  if (window.DT_LOCAL) return
  if (document.querySelector('.modal:not([hidden])')) return
  const q = document.querySelector('#q')
  const ae = document.activeElement
  if (!q) return
  if (ae && ae !== q && ae !== document.body && ae.tagName !== 'HTML') return
  try { q.focus({ preventScroll: true }) } catch {}
}
window.addEventListener('focus', () => setTimeout(autoFocusComposer, 60))
setTimeout(autoFocusComposer, 500)
setTimeout(autoFocusComposer, 1600)
`
const neu=`function composerCanFocus() {
  if (window.DT_LOCAL) return false
  if (!document.hasFocus()) return false
  if (document.querySelector('.modal:not([hidden])')) return false
  const q = document.querySelector('#q')
  if (!q) return false
  const search = document.querySelector('#search-bar')
  if (search && !search.hidden) return false
  const ae = document.activeElement
  if (ae && ae !== q && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return false
  try {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && document.querySelector('#pages')?.contains(sel.anchorNode)) return false
  } catch {}
  return true
}

function focusComposer() {
  if (!composerCanFocus()) return false
  const q = document.querySelector('#q')
  if (!q) return false
  try {
    q.focus({ preventScroll: true })
    return document.activeElement === q
  } catch {
    return false
  }
}

function autoFocusComposer() {
  focusComposer()
}

window.addEventListener('focus', () => setTimeout(focusComposer, 60))
window.addEventListener('dt:native-focus', () => setTimeout(focusComposer, 20))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(focusComposer, 60)
})
setTimeout(autoFocusComposer, 500)
setTimeout(autoFocusComposer, 1600)

// 任何非输入控件的点击，操作结束后统一把焦点还给输入框
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, .doc-item')
  if (!t) return
  if (t.closest('.modal, #welcome, #search-bar, #page-menu, #float-menu, #theme-pop, #settings')) return
  if (t.id === 'btn-search') return
  setTimeout(focusComposer, 30)
}, true)
`
if(!a.includes(old)) throw new Error('autofocus block')
a=a.replace(old,neu)
// openDoc focus
a=a.replace("  if (savedView) restoreViewState(id, savedView, endDocSwitch)\n  else requestAnimationFrame(() => requestAnimationFrame(endDocSwitch))", "  if (savedView) restoreViewState(id, savedView, () => { endDocSwitch(); setTimeout(focusComposer, 40) })\n  else requestAnimationFrame(() => requestAnimationFrame(() => { endDocSwitch(); setTimeout(focusComposer, 40) }))")
// send finally focus
a=a.replaceAll("    $('#btn-send').disabled = false\n    $('#btn-stop').hidden = true\n", "    $('#btn-send').disabled = false\n    $('#btn-stop').hidden = true\n    setTimeout(focusComposer, 0)\n")
fs.writeFileSync('public/app.js',a)
console.log('central focus manager', a.includes('function focusComposer'), a.includes('dt:native-focus'))
