import fs from 'node:fs'
let h=fs.readFileSync('public/index.html','utf8')
if(!h.includes('view-loading')){
  h=h.replace('<div id="pages"></div>', '<div id="pages"></div>\n      <div id="view-loading" hidden><span>载入中…</span></div>')
  fs.writeFileSync('public/index.html',h)
}
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('#view-loading')){
  c += `
#page-scroll.is-switching { visibility: hidden; }
#view-loading { position: absolute; inset: 54px 0 0; display: flex; align-items: center; justify-content: center; background: var(--panel); color: var(--dim); font-size: 12px; z-index: 6; }
#view-loading[hidden] { display: none; }
`
  fs.writeFileSync('public/style.css',c)
}
let a=fs.readFileSync('public/app.js','utf8')
// begin/end helpers
if(!a.includes('function beginDocSwitch')){
  a=a.replace("function saveViewState(docId = S.doc?.id) {", `function beginDocSwitch() {
  const sc = $('#page-scroll')
  const load = $('#view-loading')
  sc?.classList.add('is-switching')
  if (load) load.hidden = false
}

function endDocSwitch() {
  const sc = $('#page-scroll')
  const load = $('#view-loading')
  sc?.classList.remove('is-switching')
  if (load) load.hidden = true
}

function saveViewState(docId = S.doc?.id) {`)
}
// open doc begin/end
a=a.replace("async function openDoc(id) {\n  if (S.doc) saveViewState(S.doc.id)\n  viewRestoring = true", "async function openDoc(id) {\n  if (S.doc) saveViewState(S.doc.id)\n  beginDocSwitch()\n  viewRestoring = true")
a=a.replace("  if (r.error) {\n    viewRestoring = false\n    toast(r.error)\n    setStatus('')\n    return\n  }", "  if (r.error) {\n    viewRestoring = false\n    endDocSwitch()\n    toast(r.error)\n    setStatus('')\n    return\n  }")
a=a.replace("  updateToolbar()\n  restoreViewState(id, savedView)\n}", "  updateToolbar()\n  if (savedView) restoreViewState(id, savedView, endDocSwitch)\n  else requestAnimationFrame(() => requestAnimationFrame(endDocSwitch))\n}")
// restore onDone callback
a=a.replace("function restoreViewState(docId, view) {", "function restoreViewState(docId, view, onDone) {")
a=a.replace("  if (!v) {\n    viewRestoring = false\n    return\n  }", "  if (!v) {\n    viewRestoring = false\n    onDone?.()\n    return\n  }")
a=a.replace("  requestAnimationFrame(() => requestAnimationFrame(apply))\n  setTimeout(apply, 260)\n  setTimeout(apply, 650)", "  let revealed = false\n  const reveal = () => {\n    if (revealed) return\n    revealed = true\n    onDone?.()\n  }\n  requestAnimationFrame(() => requestAnimationFrame(() => {\n    apply()\n    reveal()\n  }))\n  setTimeout(apply, 260)\n  setTimeout(apply, 650)")
fs.writeFileSync('public/app.js',a)
console.log('no-flash overlay patch', a.includes('beginDocSwitch()') && a.includes('onDone?.()'))
