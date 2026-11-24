import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
// chip shows actual question
a=a.replace(
"    const where =\n      a.kind === 'answer' ? '回答片段' : a.kind === 'image' ? `第 ${a.page} 页框选` : a.page ? `第 ${a.page} 页` : '全文'\n    text.textContent = `${where} · 「${trunc(a.quote || '整段提问', 24)}」`",
"    const where =\n      a.kind === 'answer' ? '回答片段' : a.kind === 'image' ? `第 ${a.page} 页框选` : a.page ? `第 ${a.page} 页` : '全文'\n    const parentNode = a.kind === 'answer' && a.nodeId ? S.tree?.nodes?.[a.nodeId] : null\n    const what = a.quote || parentNode?.question || '整段提问'\n    text.textContent = `${where} · 「${trunc(what, 24)}」`"
)
// armed class on nodeEl
a=a.replace("  el.className = 'node' + (S.collapsed.has(n.id) ? ' collapsed' : '')", "  el.className = 'node' + (S.collapsed.has(n.id) ? ' collapsed' : '') + (S.pendingParent === n.id ? ' armed' : '')")
// follow-up handler mark armed + chip
a=a.replace(
"    updateChip()\n    try { window.getSelection()?.removeAllRanges() } catch {}\n    focusComposer({ end: true })",
"    updateChip()\n    document.querySelectorAll('.node.armed').forEach((x) => x.classList.remove('armed'))\n    document.querySelector(`.node[data-id=\"${n.id}\"]`)?.classList.add('armed')\n    try { window.getSelection()?.removeAllRanges() } catch {}\n    focusComposer({ end: true })"
)
// delete: clear pending if deleted, update chip
a=a.replace(
"    for (const id of dead) delete S.tree.nodes[id]\n    renderTree()",
"    for (const id of dead) delete S.tree.nodes[id]\n    if (dead.has(S.pendingParent) || (S.pendingAnchor?.nodeId && dead.has(S.pendingAnchor.nodeId))) {\n      S.pendingParent = null\n      S.pendingAnchor = null\n    }\n    renderTree()\n    updateChip()"
)
fs.writeFileSync('public/app.js',a)
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('.node.armed')){
  c += `\n.node.armed > .node-card { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }\n`
  fs.writeFileSync('public/style.css',c)
}
console.log('armed chip feedback', a.includes("classList.add('armed')"), c.includes('.node.armed'))
