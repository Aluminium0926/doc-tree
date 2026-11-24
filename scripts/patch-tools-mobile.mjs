import fs from 'node:fs'

const F = 'mobile/src/llm.js'
let t = fs.readFileSync(F, 'utf8')

// 扩展 Anthropic 消息转换（工具）
const s1 = t.indexOf('function toAnthropic(messages) {')
const e1 = t.indexOf('// \'unknown\' | \'ok\' | \'none\'', s1)
if (s1 < 0 || e1 < 0) throw new Error('toAnthropic markers')

const conv = `function toAnthropic(messages) {
  const system = []
  const out = []
  for (const m of messages || []) {
    if (m.role === 'system') {
      const t = textOf(m.content)
      if (t) system.push(t)
      continue
    }
    if (m.role === 'tool') {
      out.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: String(m.content || '') }] })
      continue
    }
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    let content
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      content = []
      if (m.content) content.push({ type: 'text', text: textOf(m.content) })
      for (const c of m.tool_calls) {
        let input = {}
        try {
          input = JSON.parse(c.function?.arguments || '{}')
        } catch {}
        content.push({ type: 'tool_use', id: c.id, name: c.function?.name, input })
      }
    } else if (typeof m.content === 'string') {
      content = m.content
    } else {
      content = (m.content || [])
        .map((part) => {
          if (part.type === 'text') return { type: 'text', text: part.text || '' }
          if (part.type === 'image_url') {
            const url = part.image_url?.url || ''
            const hit = url.match(/^data:([^;]+);base64,(.*)$/)
            if (hit) return { type: 'image', source: { type: 'base64', media_type: hit[1], data: hit[2] } }
            return { type: 'text', text: '[图片]' }
          }
          return null
        })
        .filter(Boolean)
    }
    out.push({ role, content })
  }
  const merged = []
  for (const m of out) {
    const prev = merged[merged.length - 1]
    if (prev && prev.role === m.role) {
      const a = typeof prev.content === 'string' ? [{ type: 'text', text: prev.content }] : prev.content
      const b = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content
      prev.content = [...a, ...b]
    } else merged.push({ ...m })
  }
  return { system: system.filter(Boolean).join('\\n\\n'), messages: merged }
}

`
t = t.slice(0, s1) + conv + t.slice(e1)

const loop = `
// ---------- 工具调用 ----------
function parseToolArgs(s) {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return {}
  }
}

function toolSpecsFor(format, specs) {
  return specs.map((s) =>
    format === 'anthropic'
      ? { name: s.name, description: s.description, input_schema: s.parameters }
      : { type: 'function', function: { name: s.name, description: s.description, parameters: s.parameters } }
  )
}

async function openaiToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider }) {
  const payload = JSON.stringify({
    model: model || cfg.model,
    messages,
    stream: true,
    temperature: cfg.temperature,
    max_tokens: 4096,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {})
  })
  const res = await requestModel(cfg, payload, signal, provider)
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  const calls = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') break
      try {
        const j = JSON.parse(data)
        const delta = j.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content)
        if (delta.content) {
          text += delta.content
          onDelta(delta.content)
        }
        for (const tc of delta.tool_calls || []) {
          const i = tc.index ?? 0
          calls[i] ||= { id: '', name: '', arguments: '' }
          if (tc.id) calls[i].id = tc.id
          if (tc.function?.name) calls[i].name += tc.function.name
          if (tc.function?.arguments) calls[i].arguments += tc.function.arguments
        }
      } catch {}
    }
  }
  return { text, calls: calls.filter(Boolean) }
}

async function anthropicToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider }) {
  const conv = toAnthropic(messages)
  const body = {
    model: model || cfg.model,
    max_tokens: 4096,
    messages: conv.messages,
    stream: true,
    temperature: Math.min(1, Math.max(0, cfg.temperature))
  }
  if (conv.system) body.system = conv.system
  if (tools.length) body.tools = tools
  const res = await requestModel(cfg, JSON.stringify(body), signal, provider)
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  const blocks = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') break
      try {
        const j = JSON.parse(data)
        if (j.type === 'content_block_start') {
          const cb = j.content_block || {}
          if (cb.type === 'tool_use') blocks[j.index] = { id: cb.id, name: cb.name, json: '' }
        } else if (j.type === 'content_block_delta') {
          const d = j.delta || {}
          if (d.type === 'text_delta' && d.text) {
            text += d.text
            onDelta(d.text)
          } else if (d.type === 'thinking_delta' && d.thinking && onReasoning) {
            onReasoning(d.thinking)
          } else if (d.type === 'input_json_delta' && blocks[j.index]) {
            blocks[j.index].json += d.partial_json || ''
          }
        } else if (j.type === 'message_stop') break
      } catch {}
    }
  }
  const calls = blocks.filter(Boolean).map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))
  return { text, calls }
}

export async function streamChatWithTools(messages, onDelta, { signal, model, onReasoning, provider, specs, exec, maxRounds = 6 } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey && !provider?.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const base = provider?.baseUrl || cfg.baseUrl
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  const tools = toolSpecsFor(format, specs || [])

  let rounds = 0
  while (rounds < maxRounds) {
    rounds++
    const round =
      format === 'anthropic'
        ? await anthropicToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider })
        : await openaiToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider })
    if (!round.calls.length) return

    if (format === 'anthropic') {
      messages.push({
        role: 'assistant',
        content: [
          ...(round.text ? [{ type: 'text', text: round.text }] : []),
          ...round.calls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: parseToolArgs(c.arguments) }))
        ]
      })
    } else {
      messages.push({
        role: 'assistant',
        content: round.text || null,
        tool_calls: round.calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments || '{}' } }))
      })
    }
    for (const c of round.calls) {
      let result
      try {
        result = await exec(c.name, parseToolArgs(c.arguments))
      } catch (e) {
        result = '工具执行失败：' + (e.message || e)
      }
      messages.push({ role: 'tool', tool_call_id: c.id, content: String(result) })
    }
  }
  await streamChat(messages, onDelta, { signal, model, onReasoning, provider })
}
`
if (!t.includes('streamChatWithTools')) t += loop

fs.writeFileSync(F, t)
console.log('mobile tool loop added')
