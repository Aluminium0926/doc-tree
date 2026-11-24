import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。",
  "- 已经在上文给出的内容不必重复读取；确实没有对应页时说明缺哪一页，不要编造。\n- 如果用户消息附带截图，结合图中的图表、公式和排版回答；截图与文字层冲突时以截图为准。"
)
t = t.replace(
  "  const content = []\n  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })",
  "  const content = []\n  if (image) {\n    content.push({ type: 'text', text: '【截图】下面附带一张页面或框选区域的截图，请结合图像内容回答；文字层可能漏掉图表和公式。' })\n    content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })\n  }"
)
fs.writeFileSync(F, t)
console.log('context caption ok')
