import fs from 'node:fs'

const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')

const s = t.indexOf('  const titles = all.map')
const e = t.indexOf('  const parts = []')
if (s < 0 || e < 0) throw new Error('system block markers')

const block = `  const titles = all.map((d) => \`《\${d.title}》\`).join('、')
  const mode = quote ? 'selection' : followAnswer ? 'follow' : free ? 'free' : 'page'

  const role = multi
    ? \`你是「文档树」阅读助手。用户把 \${all.length} 份文档放进同一个组（\${titles}），共享一棵提问树，问题可能跨文档。\`
    : \`你是「文档树」阅读助手。用户在阅读《\${anchorDoc.title}》，可以通过划选文字或直接提问。\`

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

  const sharedRules = \`- 输出 Markdown，段落短，可用小标题或列表；不要重复题目。
- 数学公式用 $...$（行内）或 $$...$$（独立成行）包裹；不要用 \\\\(...\\\\) 或 \\\\[...\\\\] 的写法。
- 不要生成应试辅助内容（记忆口诀、考点速记、背诵表、失分点等），除非用户明确要求。\`

  const toolRules = \`- 可用工具：read_page(page, doc?) 读取任意一页、search_docs(query, doc?) 检索、list_docs() 查看组内文档。
- 用户点名页码或需要原样引用时先 read_page；不确定内容在哪时先 search_docs。
- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。\`

  const groupRule = multi
    ? '- 跨文档对照只在问题范围内，引用时注明《文档名》第 N 页。\\n'
    : ''

  const system = \`\${role}
要求：
\${modeRules}
\${groupRule}\${sharedRules}
\${toolRules}\`

`
t = t.slice(0, s) + block + t.slice(e)

// 删除旧的 toolNote 定义
t = t.replace(/  const toolNote = `[\s\S]*?`\n/, '')

// 返回的 system 不再拼接附加段（模式规则已覆盖）
t = t.replace(
  "{ role: 'system', content: system + toolNote + (followAnswer ? '\\n\\n本次是在追问上一条回答：先承接追问分支，需要原文时调用 read_page/search_docs，不要预设文档第 1 页。' : free ? '\\n\\n本次提问没有选中文字：先根据问题自行判断需要哪几页/哪个关键词，主动调用 search_docs 或 read_page 定位原文后再回答，不要默认只讲当前页。' : '') },",
  "{ role: 'system', content: system },"
)
// 兜底：如果上面没匹配到，找 system + toolNote 开头
t = t.replace(
  "{ role: 'system', content: system + toolNote + ([\\s\\S]*?) },",
  "{ role: 'system', content: system },"
)

fs.writeFileSync(F, t)
console.log('system prompt rewritten')
