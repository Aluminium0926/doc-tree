import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
const start=a.indexOf('function markAnswerSelection(range, startEl, sel) {')
const floatStart=a.indexOf('/* ================= 浮层 ================= */', start)
if(start<0||floatStart<0) throw new Error('mark block')
const block=`function markAnswerSelection(range, startEl, sel) {
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
      }
    }
  ])
}

`
a=a.slice(0,start)+block+a.slice(floatStart)
a=a.replace("      hideFloat()\n      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」\n      $('#q').focus()", "      hideFloat()\n      try { b.run?.() } catch {}\n      // 不直接发送：只把引用挂到输入框，由你决定写不写问题、何时点「发送」\n      $('#q').focus()")
fs.writeFileSync('public/app.js',a)
console.log('deferred selection restored', a.includes("run: () => {"), a.includes('try { b.run?.() }'))
