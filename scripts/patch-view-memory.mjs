import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')

// state
a=a.replace("  doc: null,\n  tree: { nodes: {} },", "  doc: null,\n  views: (() => { try { return JSON.parse(localStorage.getItem('dt:views') || '{}') || {} } catch { return {} } })(),\n  tree: { nodes: {} },")

// save before switching
a=a.replace("async function openDoc(id) {\n  setStatus('加载中…')", "async function openDoc(id) {\n  if (S.doc) saveViewState(S.doc.id)\n  setStatus('加载中…')")

// saved view + collapsed restore
a=a.replace("  S.doc = r.doc\n  S.tree = r.tree || { nodes: {} }", "  const savedView = S.views[id] || null\n  S.doc = r.doc\n  S.tree = r.tree || { nodes: {} }")
a=a.replace("  S.collapsed.clear()\n  localStorage.setItem('dt:last', id)", "  S.collapsed = new Set(savedView?.collapsed || [])\n  localStorage.setItem('dt:last', id)")

// restore after render
a=a.replace("  else renderTextDoc()\n  updateToolbar()\n}", "  else renderTextDoc()\n  updateToolbar()\n  restoreViewState(id)\n}\n\nfunction saveViewState(docId = S.doc?.id) {\n  if (!docId) return\n  const sc = $('#page-scroll')\n  const tree = $('#tree')\n  const v = { scrollTop: sc ? sc.scrollTop : 0, treeTop: tree ? tree.scrollTop : 0, treeLeft: tree ? tree.scrollLeft : 0, collapsed: [...S.collapsed], at: Date.now() }\n  if (S.doc && S.doc.id === docId && S.doc.kind === 'pdf' && sc) {\n    v.page = currentPage()\n    const el = document.querySelector(`.page[data-page=\"${v.page}\"]`)\n    if (el) {\n      const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop\n      v.pageOffset = sc.scrollTop - top\n    }\n  }\n  S.views[docId] = v\n  try {\n    localStorage.setItem('dt:views', JSON.stringify(S.views))\n  } catch {}\n}\n\nfunction restoreViewState(docId) {\n  const v = S.views[docId]\n  if (!v) return\n  const apply = () => {\n    if (!S.doc || S.doc.id !== docId) return\n    const sc = $('#page-scroll')\n    const tree = $('#tree')\n    if (sc) {\n      if (S.doc.kind === 'pdf' && v.page) {\n        const el = document.querySelector(`.page[data-page=\"${v.page}\"]`)\n        if (el) {\n          const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop\n          sc.scrollTop = Math.max(0, top + (v.pageOffset || 0))\n        } else if (typeof v.scrollTop === 'number') {\n          sc.scrollTop = v.scrollTop\n        }\n      } else if (typeof v.scrollTop === 'number') {\n        sc.scrollTop = v.scrollTop\n      }\n      updatePageNav()\n    }\n    if (tree) {\n      if (typeof v.treeTop === 'number') tree.scrollTop = v.treeTop\n      if (typeof v.treeLeft === 'number') tree.scrollLeft = v.treeLeft\n    }\n  }\n  requestAnimationFrame(() => requestAnimationFrame(apply))\n  setTimeout(apply, 320)\n}\n\nlet viewSaveTimer = 0\nfunction scheduleViewSave() {\n  clearTimeout(viewSaveTimer)\n  viewSaveTimer = setTimeout(() => saveViewState(), 160)\n}\nwindow.addEventListener('beforeunload', () => saveViewState())\n")
fs.writeFileSync('public/app.js',a)
console.log('view memory patch', a.includes('restoreViewState(id)') && a.includes('saveViewState(S.doc.id)'))
