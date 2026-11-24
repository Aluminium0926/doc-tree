import fs from 'node:fs'

// 1) 树里的「追问」按钮：带上父节点页码
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace(
  "    S.pendingParent = n.id\n    S.pendingAnchor = { kind: 'answer', nodeId: n.id, quote: '' }",
  "    S.pendingParent = n.id\n    S.pendingAnchor = { kind: 'answer', nodeId: n.id, quote: '', page: n.anchor?.page || currentPage() }"
)
fs.writeFileSync('public/app.js', a)

// 2) 上下文：追问时不要生成「请讲解第 N 页整页内容」
let t = fs.readFileSync('lib/context.mjs', 'utf8')
t = t.replace(
  "  const ask = [\n    quote\n      ? `我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`\n      : `请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`,",
  "  const askLead = quote\n    ? `我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`\n    : followAnswer\n      ? '（继续追问上一条回答）'\n      : `请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`\n  const ask = [\n    askLead,"
)
t = t.replace(
  "  if (followAnswer) {\n    parts.push(`【本次是在追问上一条回答；上一条基于第 ${pageNo} 页（仅位置提示，需要原文请用工具读取）】`)\n  } else if (free) {",
  "  if (followAnswer) {\n    parts.push('【本次是在追问上一条回答】')\n  } else if (free) {"
)
fs.writeFileSync('lib/context.mjs', t)
console.log('follow ask fixed')
