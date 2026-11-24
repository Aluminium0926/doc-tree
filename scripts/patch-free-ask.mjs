import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const askLead = quote\n    ? `我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`\n    : followAnswer\n      ? '（继续追问上一条回答）'\n      : `请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`\n  const ask = [\n    askLead,",
  "  const askLines = []\n  if (quote) {\n    askLines.push(`我在${multi ? `《${anchorDoc.title}》` : ''}（第 ${pageNo} 页）选中了：「${quote}」`)\n  } else if (followAnswer) {\n    askLines.push('（继续追问上一条回答）')\n  } else if (!free) {\n    askLines.push(`请讲解${multi ? `《${anchorDoc.title}》` : ''}第 ${pageNo} 页的整页内容。`)\n  }\n  const ask = [\n    ...askLines,"
)
fs.writeFileSync(F, t)
console.log('free ask lead removed')
