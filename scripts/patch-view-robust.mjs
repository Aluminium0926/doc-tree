import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
const start=a.indexOf('function restoreViewState(docId) {')
const end=a.indexOf('\nlet viewSaveTimer',start)
if(start<0||end<0) throw new Error('markers')
const block=`let viewRestoring = false

function restoreViewState(docId) {
  const v = S.views[docId]
  if (!v) return
  viewRestoring = true
  const apply = () => {
    if (!S.doc || S.doc.id !== docId) return
    const sc = $('#page-scroll')
    const tree = $('#tree')
    if (sc) {
      if (typeof v.scrollTop === 'number') {
        sc.scrollTop = v.scrollTop
      } else if (S.doc.kind === 'pdf' && v.page) {
        const el = document.querySelector(\`.page[data-page="\${v.page}"]\`)
        if (el) {
          const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
          sc.scrollTop = Math.max(0, top + (v.pageOffset || 0))
        }
      }
      updatePageNav()
    }
    if (tree) {
      if (typeof v.treeTop === 'number') tree.scrollTop = v.treeTop
      if (typeof v.treeLeft === 'number') tree.scrollLeft = v.treeLeft
    }
  }
  requestAnimationFrame(() => requestAnimationFrame(apply))
  setTimeout(apply, 260)
  setTimeout(apply, 650)
  setTimeout(() => {
    if (!S.doc || S.doc.id !== docId) return
    viewRestoring = false
    saveViewState(docId)
  }, 1100)
}
`
a=a.slice(0,start)+block+a.slice(end)
a=a.replace("function scheduleViewSave() {\n  clearTimeout(viewSaveTimer)", "function scheduleViewSave() {\n  if (viewRestoring) return\n  clearTimeout(viewSaveTimer)")
fs.writeFileSync('public/app.js',a)
console.log('restore absolute + restoring guard', a.includes('let viewRestoring'))
