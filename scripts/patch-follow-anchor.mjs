import fs from 'node:fs'

// 1) 前端：追问回答时带上父节点页码
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace(
  "  S.pendingAnchor = { kind: 'answer', nodeId: card.dataset.id, quote: sel.toString().trim() }",
  "  const parentNode = S.tree?.nodes?.[card.dataset.id]\n  S.pendingAnchor = {\n    kind: 'answer',\n    nodeId: card.dataset.id,\n    quote: sel.toString().trim(),\n    page: parentNode?.anchor?.page || currentPage()\n  }"
)
fs.writeFileSync('public/app.js', a)

// 2) 上下文：追问不算“第 1 页”，不塞本页正文，给上一条的页码提示
let t = fs.readFileSync('lib/context.mjs', 'utf8')
t = t.replace(
  "  const pageNo = anchor.page || 1",
  "  const parentNode = node.parentId ? tree.nodes?.[node.parentId] : null\n  const followAnswer = anchor.kind === 'answer'\n  const pageNo = anchor.page || parentNode?.anchor?.page || 1"
)
t = t.replace(
  "  const free = Boolean(anchor.free)",
  "  const free = Boolean(anchor.free) || followAnswer"
)
t = t.replace(
  "  if (free) {\n    parts.push(`【用户没有选中文字；当前停留在第 ${pageNo} 页（只是位置提示，不能假定问题只关于这一页）】`)\n  } else if (nearby) {",
  "  if (followAnswer) {\n    parts.push(`【本次是在追问上一条回答；上一条基于第 ${pageNo} 页（仅位置提示，需要原文请用工具读取）】`)\n  } else if (free) {\n    parts.push(`【用户没有选中文字；当前停留在第 ${pageNo} 页（只是位置提示，不能假定问题只关于这一页）】`)\n  } else if (nearby) {"
)
t = t.replace(
  "(free ? '\\n\\n本次提问没有选中文字：先根据问题自行判断需要哪几页/哪个关键词，主动调用 search_docs 或 read_page 定位原文后再回答，不要默认只讲当前页。' : '')",
  "(followAnswer ? '\\n\\n本次是在追问上一条回答：先承接追问分支，需要原文时调用 read_page/search_docs，不要预设文档第 1 页。' : free ? '\\n\\n本次提问没有选中文字：先根据问题自行判断需要哪几页/哪个关键词，主动调用 search_docs 或 read_page 定位原文后再回答，不要默认只讲当前页。' : '')"
)
fs.writeFileSync('lib/context.mjs', t)
console.log('followup anchor fixed')
