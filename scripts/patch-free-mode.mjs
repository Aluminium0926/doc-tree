import fs from 'node:fs'

// 1) 前端：无选中时标记 free
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace(
  "    anchor = { kind: 'doc', page: S.doc.kind === 'pdf' ? currentPage() : 1, quote: '' }\n    S.pendingAnchor = anchor",
  "    anchor = { kind: 'doc', page: S.doc.kind === 'pdf' ? currentPage() : 1, quote: '', free: true }\n    S.pendingAnchor = anchor"
)
fs.writeFileSync('public/app.js', a)

// 2) 上下文：free 模式不给“本页正文”，改成位置提示
let t = fs.readFileSync('lib/context.mjs', 'utf8')
t = t.replace(
  "  const multi = all.length > 1",
  "  const multi = all.length > 1\n  const free = Boolean(anchor.free)"
)
t = t.replace(
  "  } else if (anchor.kind === 'doc') {\n    nearby = pageText.slice(0, 2400)\n  }",
  "  } else if (anchor.kind === 'doc' && !free) {\n    nearby = pageText.slice(0, 2400)\n  }"
)
t = t.replace(
  "  if (nearby) {\n    const who = multi ? `《${anchorDoc.title}》` : ''\n    parts.push(`【${who}第 ${pageNo} 页${quote ? '，选中处上下文' : '，本页内容'}】\\n${nearby}`)\n  }",
  "  if (free) {\n    parts.push(`【用户没有选中文字；当前停留在第 ${pageNo} 页（只是位置提示，不能假定问题只关于这一页）】`)\n  } else if (nearby) {\n    const who = multi ? `《${anchorDoc.title}》` : ''\n    parts.push(`【${who}第 ${pageNo} 页${quote ? '，选中处上下文' : '，本页内容'}】\\n${nearby}`)\n  }"
)
t = t.replace(
  "{ role: 'system', content: system + toolNote },",
  `{ role: 'system', content: system + toolNote + (free ? '\\n\\n本次提问没有选中文字：先根据问题自行判断需要哪几页/哪个关键词，主动调用 search_docs 或 read_page 定位原文后再回答，不要默认只讲当前页。' : '') },`
)
fs.writeFileSync('lib/context.mjs', t)
console.log('free mode wired')
