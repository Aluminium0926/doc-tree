import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace(
`function reactionParts(info) {
  const source = info.source
  const m = source.match(/^([^>]*)>([^>]*)>([^>]*)$/)
  if (!m) throw new Error('反应式需要 反应物>>产物')
  const split = (s) => s.split('.').map((x) => x.trim()).filter(Boolean)
  const left = split(m[1])
  const right = split(m[3])
  const agents = split(m[2])
  if (!left.length || !right.length) throw new Error('反应物或产物为空')
  return { left, right, agents, conditions: info.conditions || '' }
}`,
`function reactionParts(info) {
  const source = info.source
  const m = source.match(/^([^>]*)>([^>]*)>([^>]*)$/)
  if (!m) throw new Error('反应式需要 反应物>>产物')
  const split = (s) => s.split('.').map((x) => x.trim()).filter(Boolean)
  const spectators = new Set(['[Cl-]', '[Br-]', '[I-]', '[Na+]', '[K+]', '[Li+]', 'Cl', 'Br', 'I', 'Na', 'K'])
  const clean = (arr) => {
    if (arr.length <= 1) return arr
    const keep = arr.filter((x) => !spectators.has(x))
    return keep.length ? keep : arr
  }
  const left = clean(split(m[1]))
  const right = clean(split(m[3]))
  const agents = split(m[2])
  if (!left.length || !right.length) throw new Error('反应物或产物为空')
  return { left, right, agents, conditions: info.conditions || '' }
}`
)
fs.writeFileSync('public/chem.js',j)

let a=fs.readFileSync('public/app.js','utf8')
if(!a.includes('caret rescue')){
  a += `
// caret rescue: if the window focused but the composer lost focus, typing should still go there
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
  if (document.querySelector('.modal:not([hidden])')) return
  const ae = document.activeElement
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return
  if (e.key.length !== 1) return
  const q = document.querySelector('#q')
  if (!q) return
  q.focus({ preventScroll: true })
  q.value += e.key
  e.preventDefault()
})
`
  fs.writeFileSync('public/app.js',a)
}
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('caret-color: var(--text) !important')){
  c += `\n#q, #search-input { caret-color: var(--text) !important; }\n`
  fs.writeFileSync('public/style.css',c)
}
let ctx=fs.readFileSync('lib/context.mjs','utf8')
ctx=ctx.replace("名称用 label:，箭头上方试剂用 reagents:，箭头下方条件用 conditions:；副产物也要写进产物。", "名称用 label:，箭头上方试剂用 reagents:，箭头下方条件用 conditions:；副产物也要写进产物；不要把 Cl-、Na+ 等旁观离子写进 reaction SMILES；SMILES 必须能被 RDKit 解析，不确定时宁可只给名称和文字。")
fs.writeFileSync('lib/context.mjs',ctx)
console.log('spectator filter/caret/prompt', j.includes('spectators'), a.includes('caret rescue'), ctx.includes('旁观离子'))
