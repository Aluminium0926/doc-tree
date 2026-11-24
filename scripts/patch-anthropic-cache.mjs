import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')

  // toAnthropic：稳定段单独成块并打 cache_control
  t = t.replace(
    `    const role = m.role === 'assistant' ? 'assistant' : 'user'
    let content`,
    `    if (m.role === 'user' && m._stableText) {
      out.push({
        role: 'user',
        content: [
          { type: 'text', text: m._stableText, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: m._volatileText || '' }
        ]
      })
      continue
    }
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    let content`
  )

  // system 改成 block 数组并缓存
  t = t.replace(
    "  if (conv.system) body.system = conv.system",
    "  if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]"
  )

  // 工具定义最后一个打 cache_control
  t = t.replace(
    "  if (tools.length) body.tools = tools",
    `  if (tools.length) {
    body.tools = tools.map((tool, i) =>
      i === tools.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' } } : tool
    )
  }`
  )

  fs.writeFileSync(F, t)
}
console.log('anthropic cache_control added')
