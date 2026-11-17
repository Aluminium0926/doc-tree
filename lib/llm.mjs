// 模型调用：OpenAI 兼容 / Anthropic Messages 两种接口
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOOL_SPECS } from './context.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = process.env.DOCTREE_DATA || path.join(root, 'data')
const CONFIG = path.join(DATA, 'config.json')

const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-flash',
  apiFormat: 'auto',
  visionModel: 'deepseek-flash',
  visionBaseUrl: '',
  visionApiKey: '',
  visionFormat: 'auto',
  effort: 'high',
  temperature: 0.3
}

export const EFFORTS = ['low', 'high', 'max']

export function readConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeConfig(patch) {
  const cur = readConfig()
  const next = { ...cur, ...patch }
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true })
  fs.writeFileSync(CONFIG, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function publicConfig() {
  const c = readConfig()
  const hint = c.apiKey ? c.apiKey.slice(0, 5) + '***' + c.apiKey.slice(-4) : ''
  const vKey = c.visionApiKey || c.apiKey
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    apiFormat: c.apiFormat || 'auto',
    visionModel: c.visionModel,
    visionBaseUrl: c.visionBaseUrl || '',
    visionFormat: c.visionFormat || 'auto',
    hasKey: Boolean(c.apiKey),
    keyHint: hint,
    hasVisionKey: Boolean(vKey),
    visionKeyHint: c.visionApiKey ? vKey.slice(0, 5) + '***' + vKey.slice(-4) : ''
  }
}

// ---------- 接口格式 ----------
function resolveFormat(baseUrl, explicit) {
  if (explicit === 'anthropic' || explicit === 'openai') return explicit
  return /anthropic\.com/i.test(baseUrl || '') ? 'anthropic' : 'openai'
}

function endpointOf(baseUrl, format) {
  const base = String(baseUrl || '').replace(/\/+$/, '')
  if (format === 'anthropic') {
    if (/\/v1\/messages$/.test(base)) return base
    if (/\/v1$/.test(base)) return base + '/messages'
    return base + '/v1/messages'
  }
  return base + '/chat/completions'
}

function headersOf(key, format) {
  if (format === 'anthropic') {
    return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
  }
  return { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
}

// DeepSeek 官方端点的思考字段：thinking + reasoning_effort
function thinkingParams(cfg, effort) {
  if (!/deepseek\.com/i.test(cfg.baseUrl)) return {}
  const level = EFFORTS.includes(effort) ? effort : cfg.effort
  if (!level) return {}
  return { thinking: { type: 'enabled' }, reasoning_effort: level }
}

// ---------- 消息格式转换 ----------
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
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: String(m.content || '') }]
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
  // Anthropic 要求 user/assistant 交替，连续同角色合并
  const merged = []
  for (const m of out) {
    const prev = merged[merged.length - 1]
    if (prev && prev.role === m.role) {
      const a = typeof prev.content === 'string' ? [{ type: 'text', text: prev.content }] : prev.content
      const b = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content
      prev.content = [...a, ...b]
    } else {
      merged.push({ ...m })
    }
  }
  return { system: system.filter(Boolean).join('\n\n'), messages: merged }
}

function explain(status, body) {
  const snippet = String(body || '').slice(0, 400)
  if (status === 401) return `鉴权失败（401）：API Key 无效或已过期。${snippet}`
  if (status === 402) return `余额不足（402）。${snippet}`
  if (status === 429) return `触发限流（429），稍后再试。${snippet}`
  return `上游返回 ${status}：${snippet}`
}

function pickAnthropicText(j) {
  return (j.content || [])
    .map((b) => (b.type === 'text' ? b.text : ''))
    .filter(Boolean)
    .join('')
}

// ---------- 非流式 ----------
export async function chat(messages, { maxTokens = 600, temperature } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const format = resolveFormat(cfg.baseUrl, cfg.apiFormat)
  const temp = temperature ?? cfg.temperature

  if (format === 'anthropic') {
    const conv = toAnthropic(messages)
    const body = { model: cfg.model, max_tokens: maxTokens, messages: conv.messages, temperature: Math.min(1, Math.max(0, temp)) }
    if (conv.system) body.system = conv.system
    const res = await fetch(endpointOf(cfg.baseUrl, format), {
      method: 'POST',
      headers: headersOf(cfg.apiKey, format),
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(explain(res.status, await res.text()))
    return pickAnthropicText(await res.json())
  }

  const res = await fetch(endpointOf(cfg.baseUrl, format), {
    method: 'POST',
    headers: headersOf(cfg.apiKey, format),
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: maxTokens,
      temperature: temp,
      ...thinkingParams(cfg)
    })
  })
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const j = await res.json()
  return j.choices?.[0]?.message?.content || ''
}

// ---------- 流式 ----------
export async function streamChat(messages, onDelta, { signal, model, onReasoning, provider } = {}) {
  const cfg = readConfig()
  const baseUrl = provider?.baseUrl || cfg.baseUrl
  const key = provider?.apiKey || cfg.apiKey
  if (!key) throw new Error('未配置 API Key，请点右上角设置填写')
  const format = resolveFormat(baseUrl, provider?.format ?? cfg.apiFormat)

  let res
  if (format === 'anthropic') {
    const conv = toAnthropic(messages)
    const body = {
      model: model || cfg.model,
      max_tokens: 4096,
      messages: conv.messages,
      stream: true,
      temperature: Math.min(1, Math.max(0, cfg.temperature))
    }
    if (conv.system) body.system = conv.system
    res = await fetch(endpointOf(baseUrl, format), {
      method: 'POST',
      headers: headersOf(key, format),
      signal,
      body: JSON.stringify(body)
    })
  } else {
    res = await fetch(endpointOf(baseUrl, format), {
      method: 'POST',
      headers: headersOf(key, format),
      signal,
      body: JSON.stringify({
        model: model || cfg.model,
        messages,
        stream: true,
        temperature: cfg.temperature,
        max_tokens: 2048,
        ...thinkingParams(cfg)
      })
    })
  }
  if (!res.ok) throw new Error(explain(res.status, await res.text()))

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
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
}

// ---------- 工具调用循环 ----------

// DeepSeek 等模型会把工具调用写成 <|DSML|invoke name="read_page"> ... 的文本
function stripDSML(s) {
  return String(s || '')
    .replace(/^\s+/, '')
    .replace(/<[^>]*?invoke[^>]*?name\s*=\s*"[^"]*"[^>]*>[\s\S]*?<\/[^>]*?invoke\s*>/gi, '')
    .replace(/<[^>]*?DSML[^>]*>/gi, '')
    .replace(/<\/[^>]*?DSML[^>]*>/gi, '')
    .replace(/<\/?[^>]*?parameter[^>]*>/gi, '')
}

function visibleDSML(s) {
  const src = String(s || '')
  // 还没闭合的 DSML 段先不要显示
  const at = src.search(/<\s*[|｜]\s*[|｜]\s*DSML/i)
  const head = at >= 0 ? src.slice(0, at) : src
  return stripDSML(head)
}

function parseDSMLCalls(s) {
  const calls = []
  const re = /<[^>]*?invoke[^>]*?name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*?invoke\s*>/gi
  for (const m of String(s || '').matchAll(re)) {
    const name = m[1]
    const input = {}
    const pre = /<[^>]*?parameter[^>]*?name\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*?parameter\s*>/gi
    for (const p of m[2].matchAll(pre)) {
      input[p[1]] = p[2].trim()
    }
    if (!Object.keys(input).length && m[2].trim()) input._raw = m[2].trim()
    calls.push({ name, arguments: JSON.stringify(input) })
  }
  return calls
}

function parseToolArgs(s) {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return {}
  }
}

function toolSpecsFor(format) {
  return TOOL_SPECS.map((s) =>
    format === 'anthropic'
      ? { name: s.name, description: s.description, input_schema: s.parameters }
      : { type: 'function', function: { name: s.name, description: s.description, parameters: s.parameters } }
  )
}

async function openaiToolRound(cfg, key, base, messages, tools, { signal, model, onDelta, onReasoning }) {
  const body = {
    model: model || cfg.model,
    messages,
    stream: true,
    temperature: cfg.temperature,
    max_tokens: 4096,
    ...thinkingParams(cfg)
  }
  if (tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  const res = await fetch(endpointOf(base, 'openai'), {
    method: 'POST',
    headers: headersOf(key, 'openai'),
    signal,
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(explain(res.status, await res.text()))

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  let shown = ''
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
  return { text: stripDSML(text), calls: allCalls }
}

async function anthropicToolRound(cfg, key, base, messages, tools, { signal, model, onDelta, onReasoning }) {
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

  const res = await fetch(endpointOf(base, 'anthropic'), {
    method: 'POST',
    headers: headersOf(key, 'anthropic'),
    signal,
    body: JSON.stringify(body)
  })
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
    while ((idx = buf.indexOf('\n')) >= 0) {
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
        } else if (j.type === 'error') {
          throw new Error(j.error?.message || 'Anthropic 返回错误')
        } else if (j.type === 'message_stop') {
          break
        }
      } catch (e) {
        if (e?.message && !/JSON/.test(e.message)) throw e
      }
    }
  }
  const calls = blocks
    .filter(Boolean)
    .map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))
  return { text, calls }
}

export async function streamChatWithTools(
  messages,
  onDelta,
  { signal, model, onReasoning, provider, tools, exec, maxRounds = 6 } = {}
) {
  const cfg = readConfig()
  const base = provider?.baseUrl || cfg.baseUrl
  const key = provider?.apiKey || cfg.apiKey
  if (!key) throw new Error('未配置 API Key，请点右上角设置填写')
  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)
  const toolSpecs = toolSpecsFor(format)

  let rounds = 0
  while (rounds < maxRounds) {
    rounds++
    const round =
      format === 'anthropic'
        ? await anthropicToolRound(cfg, key, base, messages, toolSpecs, { signal, model, onDelta, onReasoning })
        : await openaiToolRound(cfg, key, base, messages, toolSpecs, { signal, model, onDelta, onReasoning })

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
        tool_calls: round.calls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: c.arguments || '{}' }
        }))
      })
    }

    for (const c of round.calls) {
      let result
      try {
        result = await exec(c.name, parseToolArgs(c.arguments))
      } catch (e) {
        result = '工具执行失败：' + (e.message || e)
      }
      if (format === 'anthropic') {
        messages.push({ role: 'tool', tool_call_id: c.id, content: String(result) })
      } else {
        messages.push({ role: 'tool', tool_call_id: c.id, content: String(result) })
      }
    }
  }

  // 轮次用尽：强制不再调工具，直接作答
  const finalMessages = messages
  await streamChat(finalMessages, onDelta, { signal, model, onReasoning, provider })
}
