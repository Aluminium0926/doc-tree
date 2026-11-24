import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("  renderLibrary()\n  renderTree()\n  $('#pages').innerHTML = ''", "  renderLibrary()\n  renderTree({ preserve: false })\n  $('#pages').innerHTML = ''")
a=a.replace("function renderTree() {\n  const g =", "function renderTree({ preserve = true } = {}) {\n  const treeRoot = $('#tree')\n  const prevTop = treeRoot ? treeRoot.scrollTop : 0\n  const prevLeft = treeRoot ? treeRoot.scrollLeft : 0\n  const g =")
a=a.replace("  build('root', 0)\n  syncTreeGap()\n}", "  build('root', 0)\n  syncTreeGap()\n  if (preserve) {\n    requestAnimationFrame(() => {\n      if (!treeRoot || !S.doc) return\n      treeRoot.scrollTop = prevTop\n      treeRoot.scrollLeft = prevLeft\n    })\n  }\n}")
fs.writeFileSync('public/app.js',a)
console.log('tree preserve patch', a.includes("renderTree({ preserve: false })"))
