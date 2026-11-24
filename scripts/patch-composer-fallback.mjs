import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 点击输入框区域时强制聚焦提问框
if (!t.includes("composerArmed")) {
  t = t.replace(
    "  $('#btn-shot').addEventListener('click', () => toggleShot())",
    `  $('#btn-shot').addEventListener('click', () => toggleShot())
  const comp = $('#composer')
  comp?.addEventListener('pointerdown', (e) => {
    S.composerArmed = Date.now() + 5000
    if (!e.target.closest('input, textarea, button')) setTimeout(() => $('#q')?.focus(), 0)
  })`
  )

  // 兜底：刚点过输入框、但没有输入框获得焦点时，把字符送进提问框
  t = t.replace(
    "  document.addEventListener('keydown', (e) => {\n    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {",
    `  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && e.key.length === 1) {
      const t2 = e.target
      const inInput = t2 instanceof Element && t2.closest('input, textarea, [contenteditable="true"], .modal')
      if (!inInput && S.doc && Date.now() < (S.composerArmed || 0)) {
        const q = $('#q')
        if (q && !q.disabled) {
          q.focus()
          q.value += e.key
          e.preventDefault()
          return
        }
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {`
  )
  fs.writeFileSync(F, t)
}
console.log('composer fallback added')
