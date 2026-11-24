import fs from 'node:fs'
let t=fs.readFileSync('lib/llm.mjs','utf8')

// openai round 签名与 server tools
t=t.replace(
  "async function openaiToolRound(cfg, key, base, messages, tools, { signal, onDelta, onReasoning, model }) {",
  "async function openaiToolRound(cfg, key, base, messages, tools, { signal, onDelta, onReasoning, model, webSearch, onWebEvent, onSources }) {"
)
t=t.replace(
  "  const payload = JSON.stringify({\n    model: model || cfg.model,\n    messages,\n    stream: true,\n    stream_options: { include_usage: true },\n    temperature: cfg.temperature,\n    max_tokens: 4096,\n    ...(tools.length ? { tools, tool_choice: 'auto' } : {})\n  })",
  "  const webTools = [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }]\n  const payload = JSON.stringify({\n    model: model || cfg.model,\n    messages,\n    stream: true,\n    stream_options: { include_usage: true },\n    temperature: cfg.temperature,\n    max_tokens: 4096,\n    ...(webSearch ? { tools: webTools } : tools.length ? { tools, tool_choice: 'auto' } : {})\n  })"
)
t=t.replace(
  "  let usage = null\n  const calls = []",
  "  let usage = null\n  let sources = null\n  const calls = []"
)
t=t.replace(
  "        const j = JSON.parse(data)\n        if (j.usage) usage = j.usage\n        const delta = j.choices?.[0]?.delta",
  "        const j = JSON.parse(data)\n        if (j.usage) usage = j.usage\n        const evt = j.choices?.[0]?.server_tool_event\n        if (evt) onWebEvent?.(evt)\n        const delta = j.choices?.[0]?.delta\n        if (delta?.annotations?.length) sources = delta.annotations"
)
t=t.replace(
  "  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai') }",
  "  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai'), sources }"
)

// streamChatWithTools webSearch 分支
t=t.replace(
  "  { signal, model, onReasoning, provider, tools, exec, onTool, maxRounds = 6 } = {}",
  "  { signal, model, onReasoning, provider, tools, exec, onTool, maxRounds = 6, webSearch, onWebEvent, onSources } = {}"
)
t=t.replace(
  "  let rounds = 0\n  let totalUsage = null\n  while (rounds < maxRounds) {",
  "  if (webSearch) {\n    const round =\n      format === 'anthropic'\n        ? await anthropicToolRound(cfg, key, base, messages, [], { signal, model, onDelta, onReasoning })\n        : await openaiToolRound(cfg, key, base, messages, [], {\n            signal,\n            model,\n            onDelta,\n            onReasoning,\n            webSearch: true,\n            onWebEvent,\n            onSources\n          })\n    if (round.sources?.length) onSources?.(round.sources)\n    return round.usage\n  }\n\n  let rounds = 0\n  let totalUsage = null\n  while (rounds < maxRounds) {"
)
fs.writeFileSync('lib/llm.mjs',t)
console.log('llm web search ok')
