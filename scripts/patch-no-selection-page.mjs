import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const anchor = S.pendingAnchor\n  let q = (forced ?? $('#q').value).trim()",
  "  let anchor = S.pendingAnchor\n  if (!anchor && S.doc) {\n    // 没选文字：锚定到当前正在看的那一页，而不是第 1 页\n    anchor = { kind: 'doc', page: S.doc.kind === 'pdf' ? currentPage() : 1, quote: '' }\n    S.pendingAnchor = anchor\n  }\n  let q = (forced ?? $('#q').value).trim()"
)
fs.writeFileSync(F, t)
console.log(t.includes('锚定到当前正在看的那一页') ? 'ok' : 'not matched')
