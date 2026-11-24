import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  if (quote) {\n    const at = locate(pageText, quote)\n    if (at >= 0) {\n      nearby = pageText.slice(Math.max(0, at - 1200), at + quote.length + 1200)\n    } else {\n      nearby = pageText.slice(0, 2400)\n    }\n  }",
  "  if (quote) {\n    const at = locate(pageText, quote)\n    if (at >= 0) {\n      nearby = pageText.slice(Math.max(0, at - 1200), at + quote.length + 1200)\n    } else {\n      nearby = pageText.slice(0, 2400)\n    }\n  } else if (anchor.kind === 'doc') {\n    // 没有选中文字：按“整页”处理（右键“讲解本页”）\n    nearby = pageText.slice(0, 2400)\n  }"
)
t = t.replace(
  "  if (nearby) parts.push(`【第 ${pageNo} 页，选中处上下文】\\n${nearby}`)",
  "  if (nearby) parts.push(`【第 ${pageNo} 页${quote ? '，选中处上下文' : '，本页内容'}】\\n${nearby}`)"
)
t = t.replace(
  "    quote ? `我选中了（第 ${pageNo} 页）：「${quote}」` : `（整篇文档提问）`,",
  "    quote ? `我选中了（第 ${pageNo} 页）：「${quote}」` : `请讲解第 ${pageNo} 页的整页内容。`,"
)
fs.writeFileSync(F, t)
console.log('patched')
