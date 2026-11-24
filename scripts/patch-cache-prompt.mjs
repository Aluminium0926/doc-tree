import fs from 'node:fs'

const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
const s = t.indexOf('  const titles = all.map')
const e = t.indexOf('  const content = []')
if (s < 0 || e < 0) throw new Error('markers missing')

const block = `  const titles = all.map((d) => \`《\${d.title}》\`).join('、')
  const mode = followAnswer ? 'follow' : quote ? 'selection' : free ? 'free' : 'page'

  // 固定不变的 system：所有文档/模式/指令共用，方便服务端做前缀缓存
  const system = \`你是「文档树」阅读助手。用户会提供文档信息、摘要和本轮要求，请据此回答。
要求：
- 遵守用户消息里的【本轮要求】。
- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\\\(...\\\\) 或 \\\\[...\\\\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记、背诵表、失分点等），除非用户明确要求。
- 可用工具：read_page(page, doc?) 读任意页、search_docs(query, doc?) 检索、list_docs() 看组内文档。
- 用户点名页码或需要原样引用时先 read_page；不确定内容在哪时先 search_docs。
- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。\`

  const modeRules = {
    selection: \`- 先给 1–2 句直接结论，再展开解释；引用原文时标注页码。
- 只解释选中的这段文字：它在说什么、为什么这样说。
- 摘要和相关段落只用于保证准确，不要在回答里复述「在全文中的位置/作用」这类结构性内容。\`,
    page: \`- 先给 1–2 句直接结论，再按页面内容展开（定义、符号、例子）。
- 这一页可能有多块内容，按逻辑顺序讲，不要逐字念稿。
- 需要引用本页或别页原文时，调用工具读取。\`,
    free: \`- 用户没有选中文字，问题范围由你判断：先确定要读哪几页、搜什么，再回答。
- 需要原文时先调用工具（search_docs / read_page），不要凭摘要猜，也不要预设只讲当前页。\`,
    follow: \`- 这是对上一条回答的追问：先承接上文，再回答新问题。
- 需要引用原文时调用工具，不要预设文档第 1 页。\`
  }[mode]

  const groupRule = multi ? '\\n- 跨文档对照只在问题范围内，引用时注明《文档名》第 N 页。' : ''

  // ---------- user：稳定内容在前，易变内容在后 ----------
  const parts = []
  if (multi) {
    parts.push(
      \`【文档组（共 \${all.length} 份，共享提问树）】\\n\` +
        all.map((d) => \`《\${d.title}》（\${(d.pages || []).length} 页）\`).join('\\n')
    )
    const sums = all
      .filter((d) => d.summary)
      .map((d) => \`《\${d.title}》：\${trim(d.summary, 500)}\`)
      .join('\\n')
    if (sums) parts.push(\`【组内文档摘要】\\n\${sums}\`)
    else parts.push(\`【文档开头】\\n\${trim(all[0].pages?.[0]?.text || '', 1200)}\`)
  } else {
    parts.push(\`【文档】\\n《\${anchorDoc.title}》（\${(anchorDoc.pages || []).length} 页）\`)
    parts.push(
      anchorDoc.summary
        ? \`【文档摘要】\\n\${anchorDoc.summary}\`
        : \`【文档开头】\\n\${trim(anchorDoc.pages?.[0]?.text || pageText, 1200)}\`
    )
  }

  const instr = all.flatMap((d) => d.instructions || []).filter(Boolean).slice(-10)
  if (instr.length) {
    parts.push(\`【用户附加指令（优先遵守）】\\n\${instr.map((x, i) => \`\${i + 1}. \${x}\`).join('\\n')}\`)
  }

  parts.push(\`【本轮要求】\\n\${modeRules}\${groupRule}\`)

  if (followAnswer) {
    parts.push('【本次是在追问上一条回答】')
  } else if (free) {
    parts.push(\`【用户没有选中文字；当前停留在第 \${pageNo} 页（只是位置提示，不能假定问题只关于这一页）】\`)
  } else if (nearby) {
    const who = multi ? \`《\${anchorDoc.title}》\` : ''
    parts.push(\`【\${who}第 \${pageNo} 页\${quote ? '，选中处上下文' : '，本页内容'}】\\n\${nearby}\`)
  }

  if (related.length) {
    parts.push(
      \`【其他相关段落】\\n\` +
        related.map((c) => \`- \${multi ? \`《\${c.title}》\` : ''}第\${c.page}页 \${trim(c.text, 700)}\`).join('\\n')
    )
  }
  if (chainText) parts.push(\`【本次追问所在的分支】\\n\${chainText}\`)

  const askLines = []
  if (quote) {
    askLines.push(\`我在\${multi ? \`《\${anchorDoc.title}》\` : ''}（第 \${pageNo} 页）选中了：「\${quote}」\`)
  } else if (followAnswer) {
    askLines.push('（继续追问上一条回答）')
  } else if (!free) {
    askLines.push(\`请讲解\${multi ? \`《\${anchorDoc.title}》\` : ''}第 \${pageNo} 页的整页内容。\`)
  }
  const ask = [...askLines, \`我的问题：\${node.question || '请讲解这段内容'}\`].join('\\n')

`
t = t.slice(0, s) + block + t.slice(e)

// 返回只带静态 system
t = t.replace(
  /  const instr = all\.flatMap\(\(d\) => d\.instructions \|\| \[\]\)\.filter\(Boolean\)\.slice\(-10\)\n  const systemWithInstr = [\s\S]*?\n\n  const content = \[\]/,
  '  const content = []'
)
t = t.replace("{ role: 'system', content: systemWithInstr },", "{ role: 'system', content: system },")
fs.writeFileSync(F, t)
console.log('cache-friendly prompt reordered')
