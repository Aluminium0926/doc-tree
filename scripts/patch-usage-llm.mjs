import fs from 'node:fs'
const F = 'lib/llm.mjs'
let t = fs.readFileSync(F, 'utf8')

// 1) usage 归一化
if (!t.includes('function normalizeUsage')) {
  t = t.replace(
    'function explain(status, body) {',
    `function normalizeUsage(u, format, rounds = 1) {
  if (!u) return null
  const n =
    format === 'anthropic'
      ? {
          input: u.input_tokens || 0,
          output: u.output_tokens || 0,
          cacheHit: u.cache_read_input_tokens || 0,
          cacheMiss: u.cache_creation_input_tokens || 0
        }
      : {
          input: u.prompt_tokens || 0,
          output: u.completion_tokens || 0,
          cacheHit: u.prompt_cache_hit_tokens || 0,
          cacheMiss: u.prompt_cache_miss_tokens || 0
        }
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

function explain(status, body) {`
  )
}

// 2) openai 轮次：请求 usage + 解析
t = t.replace(
  `    stream: true,
    temperature: cfg.temperature,
    max_tokens: 4096,`,
  `    stream: true,
    stream_options: { include_usage: true },
    temperature: cfg.temperature,
    max_tokens: 4096,`
)
t = t.replace(
  `  let text = ''
  let shown = ''
  const calls = []
  const emit = (full) => {`,
  `  let text = ''
  let shown = ''
  let usage = null
  const calls = []
  const emit = (full) => {`
)
t = t.replace(
  `        const j = JSON.parse(data)
        const delta = j.choices?.[0]?.delta
        if (!delta) continue`,
  `        const j = JSON.parse(data)
        if (j.usage) usage = j.usage
        const delta = j.choices?.[0]?.delta
        if (!delta) continue`
)
t = t.replace(
  `  const dsml = parseDSMLCalls(text)
  const allCalls = [...calls.filter(Boolean), ...dsml]
  return { text: stripDSML(text), calls: allCalls }`,
  `  const dsml = parseDSMLCalls(text)
  const allCalls = [...calls.filter(Boolean), ...dsml]
  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai') }`
)

// 3) anthropic 轮次：解析 usage
t = t.replace(
  `  let text = ''
  let shown = ''
  const blocks = []
  const emit = (full) => {`,
  `  let text = ''
  let shown = ''
  let usage = null
  const blocks = []
  const emit = (full) => {`
)
t = t.replace(
  `        const j = JSON.parse(data)
        if (j.type === 'content_block_start') {`,
  `        const j = JSON.parse(data)
        if (j.type === 'message_start' && j.message?.usage) usage = { ...(usage || {}), ...j.message.usage }
        if (j.type === 'message_delta' && j.usage) usage = { ...(usage || {}), ...j.usage }
        if (j.type === 'content_block_start') {`
)
t = t.replace(
  `  const dsml = parseDSMLCalls(text)
  return { text: stripDSML(text), calls: [...structured, ...dsml] }`,
  `  const dsml = parseDSMLCalls(text)
  return { text: stripDSML(text), calls: [...structured, ...dsml], usage: normalizeUsage(usage, 'anthropic') }`
)

// 4) 循环累计 usage 并返回
t = t.replace(
  `  let rounds = 0
  while (rounds < maxRounds) {`,
  `  let rounds = 0
  let totalUsage = null
  while (rounds < maxRounds) {`
)
t = t.replace(
  `    if (!round.calls.length) return`,
  `    totalUsage = mergeUsage(totalUsage, round.usage)
    if (!round.calls.length) return totalUsage`
)
t = t.replace(
  `  // 轮次用尽：强制不再调工具，直接作答
  const finalMessages = messages
  await streamChat(finalMessages, onDelta, { signal, model, onReasoning, provider })`,
  `  // 轮次用尽：强制不再调工具，直接作答
  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })
  return mergeUsage(totalUsage, finalUsage)`
)

// 5) streamChat 也收集 usage 并返回
t = t.replace(
  `      try {
        const j = JSON.parse(data)
        if (format === 'anthropic') {`,
  `      try {
        const j = JSON.parse(data)
        if (j.usage) usage = { ...(usage || {}), ...j.usage }
        if (j.type === 'message_start' && j.message?.usage) usage = { ...(usage || {}), ...j.message.usage }
        if (j.type === 'message_delta' && j.usage) usage = { ...(usage || {}), ...j.usage }
        if (format === 'anthropic') {`
)
t = t.replace(
  `  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {`,
  `  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let usage = null
  while (true) {`
)
t = t.replace(
  `        if (format === 'anthropic' && e?.message) throw e
      }
    }
  }
}`,
  `        if (format === 'anthropic' && e?.message) throw e
      }
    }
  }
  return normalizeUsage(usage, format)
}`
)
fs.writeFileSync(F, t)
console.log('usage parsing added')
