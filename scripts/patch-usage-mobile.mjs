import fs from 'node:fs'
const F = 'mobile/src/llm.js'
let t = fs.readFileSync(F, 'utf8')

if (!t.includes('function normalizeUsage')) {
  t = t.replace('function parseToolArgs(s) {', `function normalizeUsage(u, format, rounds = 1) {
  if (!u) return null
  const n =
    format === 'anthropic'
      ? { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheHit: u.cache_read_input_tokens || 0, cacheMiss: u.cache_creation_input_tokens || 0 }
      : { input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cacheHit: u.prompt_cache_hit_tokens || 0, cacheMiss: u.prompt_cache_miss_tokens || 0 }
  n.total = u.total_tokens || n.input + n.output
  n.rounds = rounds
  return n
}

function mergeUsage(a, b) {
  if (!b) return a
  if (!a) return { ...b }
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheHit: a.cacheHit + b.cacheHit,
    cacheMiss: a.cacheMiss + b.cacheMiss,
    total: a.total + b.total,
    rounds: Math.max(a.rounds || 1, b.rounds || 1)
  }
}

function parseToolArgs(s) {`)
}

// openai round
t = t.replace(
  "    stream: true,\n    temperature: cfg.temperature,\n    max_tokens: 4096,",
  "    stream: true,\n    stream_options: { include_usage: true },\n    temperature: cfg.temperature,\n    max_tokens: 4096,"
)
t = t.replace(
  "  let text = ''\n  let shown = ''\n  const calls = []",
  "  let text = ''\n  let shown = ''\n  let usage = null\n  const calls = []"
)
t = t.replace(
  "        const j = JSON.parse(data)\n        const delta = j.choices?.[0]?.delta\n        if (!delta) continue",
  "        const j = JSON.parse(data)\n        if (j.usage) usage = j.usage\n        const delta = j.choices?.[0]?.delta\n        if (!delta) continue"
)
t = t.replace(
  "  const dsml = parseDSMLCalls(text)\n  const allCalls = [...calls.filter(Boolean), ...dsml]\n  return { text: stripDSML(text), calls: allCalls }",
  "  const dsml = parseDSMLCalls(text)\n  const allCalls = [...calls.filter(Boolean), ...dsml]\n  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai') }"
)

// anthropic round
t = t.replace(
  "  let text = ''\n  let shown = ''\n  const blocks = []",
  "  let text = ''\n  let shown = ''\n  let usage = null\n  const blocks = []"
)
t = t.replace(
  "        const j = JSON.parse(data)\n        if (j.type === 'content_block_start') {",
  "        const j = JSON.parse(data)\n        if (j.type === 'message_start' && j.message?.usage) usage = { ...(usage || {}), ...j.message.usage }\n        if (j.type === 'message_delta' && j.usage) usage = { ...(usage || {}), ...j.usage }\n        if (j.type === 'content_block_start') {"
)
t = t.replace(
  "  const calls = blocks.filter(Boolean).map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))\n  return { text, calls }",
  "  const calls = blocks.filter(Boolean).map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))\n  return { text, calls, usage: normalizeUsage(usage, 'anthropic') }"
)

// loop
t = t.replace(
  "  let rounds = 0\n  while (rounds < maxRounds) {",
  "  let rounds = 0\n  let totalUsage = null\n  while (rounds < maxRounds) {"
)
t = t.replace(
  "    if (!round.calls.length) return",
  "    totalUsage = mergeUsage(totalUsage, round.usage)\n    if (!round.calls.length) return totalUsage"
)
t = t.replace(
  "  await streamChat(messages, onDelta, { signal, model, onReasoning, provider })\n}",
  "  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })\n  return mergeUsage(totalUsage, finalUsage)\n}"
)

// streamChat 收集 usage 并返回
t = t.replace(
  "  const reader = res.body.getReader()\n  const dec = new TextDecoder()\n  let buf = ''\n  while (true) {",
  "  const reader = res.body.getReader()\n  const dec = new TextDecoder()\n  let buf = ''\n  let usage = null\n  while (true) {"
)
t = t.replace(
  "        const j = JSON.parse(data)\n        if (format === 'anthropic') {",
  "        const j = JSON.parse(data)\n        if (j.usage) usage = { ...(usage || {}), ...j.usage }\n        if (j.type === 'message_start' && j.message?.usage) usage = { ...(usage || {}), ...j.message.usage }\n        if (j.type === 'message_delta' && j.usage) usage = { ...(usage || {}), ...j.usage }\n        if (format === 'anthropic') {"
)
t = t.replace(
  "        if (format === 'anthropic' && e?.message) throw e\n      }\n    }\n  }\n}",
  "        if (format === 'anthropic' && e?.message) throw e\n      }\n    }\n  }\n  return normalizeUsage(usage, format)\n}"
)
fs.writeFileSync(F, t)
console.log('mobile usage added')
