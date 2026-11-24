import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "- 下面已经提供了文档全文或相关页/页面索引；只要其中有对应内容，就直接依据它回答，**不要声称没有拿到某页文字**。\n- 若确实没有该页，再说明缺哪一页，并请用户贴出原文。\n",
  ""
)
const note = `  const toolNote = \`

工具（需要原文时先调用，不要凭摘要猜）：
- read_page(page, doc?)：读取任意一页的完整原文，page 从 1 开始
- search_docs(query, doc?)：在文档或组内按关键词检索
- list_docs()：查看组内有哪些文档
用户提到某页时先 read_page；不确定内容在哪时先 search_docs。\`

`
t = t.replace('  const content = []', note + '  const content = []')
t = t.replace("{ role: 'system', content: system },", "{ role: 'system', content: system + toolNote },")
fs.writeFileSync(F, t)
console.log('tool note appended')
