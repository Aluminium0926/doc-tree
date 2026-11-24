import fs from 'node:fs'
let t=fs.readFileSync('mobile/src/llm.js','utf8')
t=t.replace(
  "async function openaiToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider }) {",
  "async function openaiToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider, webSearch, onWebEvent, onSources }) {"
)
t=t.replace(
  "  const payload = JSON.stringify({\n    model: model || cfg.model,\n    messages,\n    stream: true,\n    stream_options: { include_usage: true },\n    temperature: cfg.temperature,\n    max_tokens: 4096,\n    ...(tools.length ? { tools, tool_choice: 'auto' } : {})\n  })",
  "  const webTools = [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }]\n  const payload = JSON.stringify({\n    model: model || cfg.model,\n    messages,\n    stream: true,\n    stream_options: { include_usage: true },\n    temperature: cfg.temperature,\n    max_tokens: 4096,\n    ...(webSearch ? { tools: webTools } : tools.length ? { tools, tool_choice: 'auto' } : {})\n  })"
)
t=t.replace("  let usage = null\n  const calls = []", "  let usage = null\n  let sources = null\n  const calls = []")
t=t.replace(
  "        const j = JSON.parse(data)\n        const delta = j.choices?.[0]?.delta\n        if (!delta) continue",
  "        const j = JSON.parse(data)\n        const evt = j.choices?.[0]?.server_tool_event\n        if (evt) onWebEvent?.(evt)\n        const delta = j.choices?.[0]?.delta\n        if (delta?.annotations?.length) sources = delta.annotations\n        if (!delta) continue"
)
t=t.replace(
  "  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai') }",
  "  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai'), sources }"
)
t=t.replace(
  "export async function streamChatWithTools(messages, onDelta, { signal, model, onReasoning, provider, specs, exec, maxRounds = 6 } = {}) {",
  "export async function streamChatWithTools(messages, onDelta, { signal, model, onReasoning, provider, specs, exec, maxRounds = 6, webSearch, onWebEvent, onSources } = {}) {"
)
t=t.replace(
  "  let rounds = 0\n  let totalUsage = null\n  while (rounds < maxRounds) {",
  "  if (webSearch) {\n    const round =\n      format === 'anthropic'\n        ? await anthropicToolRound(cfg, messages, [], { signal, onDelta, onReasoning, model, provider })\n        : await openaiToolRound(cfg, messages, [], { signal, onDelta, onReasoning, model, provider, webSearch: true, onWebEvent, onSources })\n    if (round.sources?.length) onSources?.(round.sources)\n    return round.usage\n  }\n\n  let rounds = 0\n  let totalUsage = null\n  while (rounds < maxRounds) {"
)
fs.writeFileSync('mobile/src/llm.js',t)
console.log('mobile llm web ok')
