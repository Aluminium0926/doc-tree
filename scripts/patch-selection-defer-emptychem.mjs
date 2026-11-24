import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
// markAnswerSelection defer state until float button click
a=a.replace(
`function markAnswerSelection(range, startEl, sel) {
  const card = startEl.closest('.node')
  if (!card) return hideFloat()
  const parentNode = S.tree?.nodes?.[card.dataset.id]
  S.pendingAnchor = {
    kind: 'answer',
    nodeId: card.dataset.id,
    quote: sel.toString().trim(),
    page: parentNode?.anchor?.page || currentPage()
  }
  S.pendingParent = card.dataset.id
  updateChip()
  showFloat(range, [{ label: '追问这段', primary: true, act: 'ask' }])
}`,
`function markAnswerSelection(range, startEl, sel) {
  const card = startEl.closest('.node')
  if (!card) return hideFloat()
  const parentNode = S.tree?.nodes?.[card.dataset.id]
  const anchor = {
    kind: 'answer',
    nodeId: card.dataset.id,
    quote: sel.toString().trim(),
    page: parentNode?.anchor?.page || currentPage()
  }
  const parentId = card.dataset.id
  showFloat(range, [
    {
      label: '追问这段',
      primary: true,
      run: () => {
        S.pendingAnchor = anchor
        S.pendingParent = parentId
        updateChip()
        document.querySelectorAll('.node.armed').forEach((x) => x.classList.remove('armed'))
        document.querySelector(\`.node[data-id="\${parentId}"]\`)?.classList.add('armed')
      }
    }
  ])
}`
)
// showFloat run callback
a=a.replace("    btn.addEventListener('click', () => {\n      hideFloat()\n      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」\n      $('#q').focus()", "    btn.addEventListener('click', () => {\n      hideFloat()\n      try { b.run?.() } catch {}\n      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」\n      focusComposer({ end: true })")
fs.writeFileSync('public/app.js',a)

let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace("    const raw = code.textContent || ''\n    if (!raw.trim()) continue\n    const { fig, info } = makeFigure(lang, raw)", "    const raw = code.textContent || ''\n    if (!raw.trim()) continue\n    const parsed = parseBlock(lang, raw)\n    if (!parsed.source) continue\n    const { fig, info } = makeFigure(lang, raw)")
j=j.replace("async function moleculeSvg(source, bond = 18) {\n  const key = bond + ':' + source", "async function moleculeSvg(source, bond = 18) {\n  if (!String(source || '').trim()) throw new Error('没有提供 SMILES')\n  const key = bond + ':' + source")
fs.writeFileSync('public/chem.js',j)
console.log('defer answer arm/empty chem skip', a.includes('run: () =>'), j.includes('parsed.source'))
