import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    S.pendingAnchor = { kind: 'doc', page: pageNo, quote: '' }\n    send('讲解本页内容')",
  "    S.pendingAnchor = { kind: 'doc', page: pageNo, quote: '' }\n    // 没有文字层的页（扫描件）：直接把这一页的渲染图交给视觉模型\n    const page = (S.doc.pages || []).find((p) => p.no === pageNo)\n    const text = (page?.text || '').trim()\n    if (text.length < 20) {\n      const cv = document.querySelector(`.page[data-page=\"${pageNo}\"] canvas`)\n      if (cv) {\n        try {\n          S.pendingShot = cv.toDataURL('image/jpeg', 0.85)\n        } catch {}\n      }\n    }\n    send('讲解本页内容')"
)
fs.writeFileSync(F, t)
console.log(t.includes('toDataURL') ? 'fallback ok' : 'not matched')
