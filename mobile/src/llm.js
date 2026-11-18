// 模型调用：优先本地/服务端代理（/proxy/llm），不可用时直连（OpenAI 兼容 / Anthropic）
import { readConfig, thinkingParams } from './config.js'

function resolveFormat(baseUrl, explicit) {
  if (explicit === 'anthropic' || explicit === 'openai') return explicit
  return /anthropic\.com/i.test(baseUrl || '') ? 'anthropic' : 'openai'
}

function endpointFor(cfg, provider) {
  const base = (provider?.baseUrl || cfg.baseUrl).replace(/\/+$/, '')
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  if (format === 'anthropic') {
    if (/\/v1\/messages$/.test(base)) return base
    if (/\/v1$/.test(base)) return base + '/messages'
    return base + '/v1/messages'
  }
  return base + '/chat/completions'
}

function authHeaders(cfg, provider, format, direct) {
  const key = provider?.apiKey || cfg.apiKey
  if (format === 'anthropic') {
    const h = { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
    if (direct) h['anthropic-dangerous-direct-browser-access'] = 'true'
    return h
  }
  return { authorization: `Bearer ${key}` }
}

function proxyHeaders(cfg, provider) {
  const base = provider?.baseUrl || cfg.baseUrl
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  return {
    ...authHeaders(cfg, provider, format, false),
    'content-type': 'application/json',
    'x-target': endpointFor(cfg, provider)
  }
}

function directHeaders(cfg, provider) {
  const base = provider?.baseUrl || cfg.baseUrl
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  return { ...authHeaders(cfg, provider, format, true), 'content-type': 'application/json' }
}

function explain(status, body) {
  const snippet = String(body || '').slice(0, 400)
  if (status === 401) return `鉴权失败（401）：API Key 无效或已过期。${snippet}`
  if (status === 402) return `余额不足（402）。${snippet}`
  if (status === 429) return `触发限流（429），稍后再试。${snippet}`
  return `上游返回 ${status}：${snippet}`
}

// 消息 → Anthropic 格式
function textOf(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((p) => p?.text || '').filter(Boolean).join('\n')
  return ''
}

function toAnthropic(messages) {
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
    if (m.role === 'user' && m._stableText) {
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
  return { system: system.filter(Boolean).join('\n\n'), messages: merged }
}

// 'unknown' | 'ok' | 'none'
let proxyState = 'unknown'

function setProxyState(v) {
  proxyState = v
  window.__DT_PROXY_STATE = v
}

function looksLikeModelResponse(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  return ct.includes('application/json') || ct.includes('text/event-stream')
}

async function requestModel(cfg, payload, signal, provider) {
  if (proxyState !== 'none') {
    try {
      const res = await fetch('/proxy/llm', {
        method: 'POST',
        headers: proxyHeaders(cfg, provider),
        body: payload,
        signal
      })
      if (res.ok && looksLikeModelResponse(res)) {
        setProxyState('ok')
        return res
      }
      if (res.status === 404 || res.status === 405 || !looksLikeModelResponse(res)) {
        setProxyState('none')
      } else {
        setProxyState('ok')
        return res
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw e
      setProxyState('none')
    }
  }
  return fetch(endpointFor(cfg, provider), {
    method: 'POST',
    headers: directHeaders(cfg, provider),
    body: payload,
    signal
  })
}

function anthropicBody(cfg, messages, { model, stream, maxTokens }) {
  const conv = toAnthropic(messages)
  const body = {
    model: model || cfg.model,
    max_tokens: maxTokens || 4096,
    messages: conv.messages,
    temperature: Math.min(1, Math.max(0, cfg.temperature ?? 0.3))
  }
  if (stream) body.stream = true
  if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]
  return body
}

export async function chat(messages, { maxTokens = 700, effort } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const format = resolveFormat(cfg.baseUrl, cfg.apiFormat)
  const payload =
    format === 'anthropic'
      ? JSON.stringify(anthropicBody(cfg, messages, { maxTokens }))
      : JSON.stringify({
          model: cfg.model,
          messages,
          max_tokens: maxTokens,
          temperature: cfg.temperature,
          ...thinkingParams(cfg, effort)
        })
  let res
  try {
    res = await requestModel(cfg, payload)
  } catch (e) {
    throw new Error(`请求模型失败（${proxyState === 'none' ? '直连 ' + endpointFor(cfg) : '本地代理'}）：${e.message}`)
  }
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const j = await res.json()
  if (format === 'anthropic') {
    return (j.content || []).map((b) => (b.type === 'text' ? b.text : '')).filter(Boolean).join('')
  }
  return j.choices?.[0]?.message?.content || ''
}

export async function streamChat(messages, onDelta, { signal, model, onReasoning, provider } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey && !provider?.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')

  const base = provider?.baseUrl || cfg.baseUrl
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  const payload =
    format === 'anthropic'
      ? JSON.stringify(anthropicBody(cfg, messages, { model, stream: true, maxTokens: 4096 }))
      : JSON.stringify({
          model: model || cfg.model,
          messages,
          stream: true,
          temperature: cfg.temperature,
          max_tokens: 2048,
          ...thinkingParams(cfg)
        })

  let res
  try {
    res = await requestModel(cfg, payload, signal, provider)
  } catch (e) {
    if (e && e.name === 'AbortError') throw e
    const where = proxyState === 'none' ? '直连 ' + endpointFor(cfg, provider) : '本地代理'
    throw new Error(`请求模型失败（${where}）：${e.message}。如果直连失败，通常是该端点不允许浏览器跨域，需要部署 /proxy/llm 代理。`)
  }
  if (!res.ok) throw new Error(explain(res.status, await res.text()))

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let usage = null
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const j = JSON.parse(data)
        if (j.usage) usage = { ...(usage || {}), ...j.usage }
        if (j.type === 'message_start' && j.message?.usage) usage = { ...(usage || {}), ...j.message.usage }
        if (j.type === 'message_delta' && j.usage) usage = { ...(usage || {}), ...j.usage }
        if (format === 'anthropic') {
          if (j.type === 'content_block_delta') {
            const d = j.delta || {}
            if (d.type === 'thinking_delta' && d.thinking && onReasoning) onReasoning(d.thinking)
            if (d.type === 'text_delta' && d.text) onDelta(d.text)
          } else if (j.type === 'error') {
            throw new Error(j.error?.message || 'Anthropic 返回错误')
          } else if (j.type === 'message_stop') {
            return
          }
          continue
        }
        const delta = j.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content)
        if (delta.content) onDelta(delta.content)
      } catch (e) {
        if (format === 'anthropic' && e?.message) throw e
      }
    }
  }
  return normalizeUsage(usage, format)
}

// ---------- 工具调用 ----------

function normalizeDSML(s) {
  return String(s || '')
    .replace(/\uFF1C/g, '<')
    .replace(/\uFF1E/g, '>')
    .replace(/\uFF5C/g, '|')
    .replace(/\uFF0F/g, '/')
    .replace(/\uFF02/g, '"')
    .replace(/\uFF1D/g, '=')
}

function stripDSML(s) {
  return normalizeDSML(s)
    .replace(/^\s+/, '')
    .replace(/<[^>]*?invoke[^>]*?name\s*=\s*"[^"]*"[^>]*>[\s\S]*?<\/[^>]*?invoke\s*>/gi, '')
    .replace(/<[^>]*?DSML[^>]*>/gi, '')
    .replace(/<\/[^>]*?DSML[^>]*>/gi, '')
    .replace(/<\/?[^>]*?parameter[^>]*>/gi, '')
    .trim()
}

function visibleDSML(s) {
  const src = normalizeDSML(s)
  const at = src.search(/<\s*[|｜]\s*(?:[|｜]\s*)?DSML/i)
  let head = at >= 0 ? src.slice(0, at) : src
  for (const p of ['<|DSML|', '<|DSML', '<|DSM', '<|DS', '<|D', '<|', '<']) {
    if (head.endsWith(p)) {
      head = head.slice(0, head.length - p.length)
      break
    }
  }
  return stripDSML(head)
}

function parseDSMLCalls(s) {
  const calls = []
  s = normalizeDSML(s)
  const re = /<[^>]*?invoke[^>]*?name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*?invoke\s*>/gi
  for (const m of String(s || '').matchAll(re)) {
    const input = {}
    const pre = /<[^>]*?parameter[^>]*?name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*?parameter\s*>/gi
    for (const p of m[2].matchAll(pre)) input[p[1]] = p[2].trim()
    if (!Object.keys(input).length && m[2].trim()) input._raw = m[2].trim()
    calls.push({ name: m[1], arguments: JSON.stringify(input) })
  }
  return calls
}

function normalizeUsage(u, format, rounds = 1) {
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
    stream_options: { include_usage: true },
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
  let shown = ''
  let usage = null
  const calls = []
  const emit = (full) => {
    const vis = visibleDSML(full)
    if (vis.length > shown.length) {
      onDelta(vis.slice(shown.length))
      shown = vis
    }
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') break
      try {
        const j = JSON.parse(data)
        if (j.usage) usage = j.usage
        const delta = j.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content)
        if (delta.content) {
          text += delta.content
          emit(text)
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
  const dsml = parseDSMLCalls(text)
  const allCalls = [...calls.filter(Boolean), ...dsml]
  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai') }
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
  if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]
  if (tools.length) {
    body.tools = tools.map((tool, i) =>
      i === tools.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' } } : tool
    )
  }
  const res = await requestModel(cfg, JSON.stringify(body), signal, provider)
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  let shown = ''
  let usage = null
  const blocks = []
  const emit = (full) => {
    const vis = visibleDSML(full)
    if (vis.length > shown.length) {
      onDelta(vis.slice(shown.length))
      shown = vis
    }
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') break
      try {
        const j = JSON.parse(data)
        if (j.type === 'message_start' && j.message?.usage) usage = { ...(usage || {}), ...j.message.usage }
        if (j.type === 'message_delta' && j.usage) usage = { ...(usage || {}), ...j.usage }
        if (j.type === 'content_block_start') {
          const cb = j.content_block || {}
          if (cb.type === 'tool_use') blocks[j.index] = { id: cb.id, name: cb.name, json: '' }
        } else if (j.type === 'content_block_delta') {
          const d = j.delta || {}
          if (d.type === 'text_delta' && d.text) {
            text += d.text
            emit(text)
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
  return { text, calls, usage: normalizeUsage(usage, 'anthropic') }
}

export async function streamChatWithTools(messages, onDelta, { signal, model, onReasoning, provider, specs, exec, maxRounds = 6 } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey && !provider?.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const base = provider?.baseUrl || cfg.baseUrl
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  const tools = toolSpecsFor(format, specs || [])

  let rounds = 0
  let totalUsage = null
  while (rounds < maxRounds) {
    rounds++
    const round =
      format === 'anthropic'
        ? await anthropicToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider })
        : await openaiToolRound(cfg, messages, tools, { signal, onDelta, onReasoning, model, provider })
    totalUsage = mergeUsage(totalUsage, round.usage)
    if (!round.calls.length) {
      if (totalUsage) totalUsage.rounds = rounds
      return totalUsage
    }

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
      try {
        onTool?.({ name: c.name, args: parseToolArgs(c.arguments) })
      } catch {}
      let result
      try {
        result = await exec(c.name, parseToolArgs(c.arguments))
      } catch (e) {
        result = '工具执行失败：' + (e.message || e)
      }
      messages.push({ role: 'tool', tool_call_id: c.id, content: String(result) })
    }
  }
  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })
  const merged = mergeUsage(totalUsage, finalUsage)
  if (merged) merged.rounds = rounds
  return merged
}
