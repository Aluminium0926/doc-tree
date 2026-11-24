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
          if (part.type === 'tool_use' || part.type === 'tool_result' || part.type === 'image') return part
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url, opts, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, opts)
      const retryable = res.status === 429 || [500, 502, 503, 504].includes(res.status)
      if (res.ok || !retryable || attempt >= retries) return res
      const retryAfter = Number(res.headers.get('retry-after')) * 1000
      await sleep(retryAfter > 0 ? retryAfter : 600 * 2 ** attempt)
    } catch (e) {
      if (opts?.signal?.aborted || attempt >= retries) throw e
      await sleep(600 * 2 ** attempt)
    }
  }
}

function anthropicImageBlock(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl || ''))
  return {
    type: 'image',
    source: { type: 'base64', media_type: m?.[1] || 'image/png', data: m?.[2] || '' }
  }
}

function normalizeUsage(u, format, rounds = 1) {
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
export async function chat(messages, { maxTokens = 600, temperature, model, provider } = {}) {
  const cfg = readConfig()
  const baseUrl = provider?.baseUrl || cfg.baseUrl
  const key = provider?.apiKey || cfg.apiKey
  if (!key) throw new Error('未配置 API Key，请点右上角设置填写')
  const format = resolveFormat(baseUrl, provider?.format ?? cfg.apiFormat)
  const temp = temperature ?? cfg.temperature
  const useModel = model || cfg.model

  if (format === 'anthropic') {
    const conv = toAnthropic(messages)
    const body = { model: useModel, max_tokens: maxTokens, messages: conv.messages, temperature: Math.min(1, Math.max(0, temp)) }
    if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]
    const res = await fetchWithRetry(endpointOf(baseUrl, format), {
      method: 'POST',
      headers: headersOf(key, format),
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(explain(res.status, await res.text()))
    return pickAnthropicText(await res.json())
  }

  const res = await fetchWithRetry(endpointOf(baseUrl, format), {
    method: 'POST',
    headers: headersOf(key, format),
    body: JSON.stringify({
      model: useModel,
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

export async function ocrImage(dataUrl) {
  const cfg = readConfig()
  const provider =
    cfg.visionBaseUrl || cfg.visionApiKey
      ? {
          baseUrl: cfg.visionBaseUrl || cfg.baseUrl,
          apiKey: cfg.visionApiKey || cfg.apiKey,
          format: cfg.visionFormat || cfg.apiFormat
        }
      : undefined
  const text = await chat(
    [
      { role: 'system', content: '你是 OCR 引擎。只提取图片中的文字，保持原有段落、标题、列表和表格顺序；不要解释、不要总结、不要补充。图片里没有文字就输出空字符串。' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '提取这张图片里的全部文字。' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
        ]
      }
    ],
    { maxTokens: 4096, temperature: 0, model: cfg.visionModel || cfg.model, provider }
  )
  return String(text || '').trim()
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
    if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]
    res = await fetchWithRetry(endpointOf(baseUrl, format), {
      method: 'POST',
      headers: headersOf(key, format),
      signal,
      body: JSON.stringify(body)
    })
  } else {
    res = await fetchWithRetry(endpointOf(baseUrl, format), {
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

// ---------- 工具调用循环 ----------

// DeepSeek 等模型会把工具调用写成 <|DSML|invoke name="read_page"> ... 的文本
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

async function openaiToolRound(cfg, key, base, messages, tools, { signal, model, onDelta, onReasoning, webSearch, onWebEvent, onSources }) {
  const body = {
    model: model || cfg.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: cfg.temperature,
    max_tokens: 4096,
    ...thinkingParams(cfg)
  }
  if (webSearch) {
    body.tools = [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }]
  } else if (tools.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  const res = await fetchWithRetry(endpointOf(base, 'openai'), {
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
  let usage = null
  let sources = null
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
        const evt = j.choices?.[0]?.server_tool_event
        if (evt) onWebEvent?.(evt)
        const delta = j.choices?.[0]?.delta
        if (delta?.annotations?.length) sources = delta.annotations
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
  return { text: stripDSML(text), calls: allCalls, usage: normalizeUsage(usage, 'openai'), sources }
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
  if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]
  if (tools.length) {
    body.tools = tools.map((tool, i) =>
      i === tools.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' } } : tool
    )
  }

  const res = await fetchWithRetry(endpointOf(base, 'anthropic'), {
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
  const structured = blocks
    .filter(Boolean)
    .map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))
  const dsml = parseDSMLCalls(text)
  return { text: stripDSML(text), calls: [...structured, ...dsml], usage: normalizeUsage(usage, 'anthropic') }
}

export async function streamChatWithTools(
  messages,
  onDelta,
  { signal, model, onReasoning, provider, tools, exec, onTool, maxRounds = 6, webSearch, onWebEvent, onSources, extraTools } = {}
) {
  const cfg = readConfig()
  const base = provider?.baseUrl || cfg.baseUrl
  const key = provider?.apiKey || cfg.apiKey
  if (!key) throw new Error('未配置 API Key，请点右上角设置填写')
  const explicitFormat = provider?.format && provider.format !== 'auto' ? provider.format : cfg.apiFormat
  const format = resolveFormat(base, explicitFormat)
  const extras = (extraTools || []).map((x) =>
    format === 'anthropic'
      ? { name: x.function.name, description: x.function.description, input_schema: x.function.parameters }
      : x
  )
  const toolSpecs = [...toolSpecsFor(format), ...extras]

  if (webSearch) {
    const round =
      format === 'anthropic'
        ? await anthropicToolRound(cfg, key, base, messages, [], { signal, model, onDelta, onReasoning })
        : await openaiToolRound(cfg, key, base, messages, [], {
            signal,
            model,
            onDelta,
            onReasoning,
            webSearch: true,
            onWebEvent,
            onSources
          })
    if (round.sources?.length) onSources?.(round.sources)
    return round.usage
  }

  let rounds = 0
  let totalUsage = null
  while (rounds < maxRounds) {
    rounds++
    const round =
      format === 'anthropic'
        ? await anthropicToolRound(cfg, key, base, messages, toolSpecs, { signal, model, onDelta, onReasoning })
        : await openaiToolRound(cfg, key, base, messages, toolSpecs, { signal, model, onDelta, onReasoning })

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
        tool_calls: round.calls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: c.arguments || '{}' }
        }))
      })
    }

    const results = []
    for (const c of round.calls) {
      try {
        onTool?.({ name: c.name, args: parseToolArgs(c.arguments) })
      } catch {}
      let raw
      try {
        raw = await exec(c.name, parseToolArgs(c.arguments))
      } catch (e) {
        raw = '工具执行失败：' + (e.message || e)
      }
      const text = typeof raw === 'string' ? raw : String(raw?.text ?? '')
      const image = raw && typeof raw === 'object' && raw.image ? raw.image : null
      results.push({ call: c, text, image })
    }

    if (format === 'anthropic') {
      messages.push({
        role: 'user',
        content: results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.call.id,
          content: r.image
            ? [{ type: 'text', text: r.text }, anthropicImageBlock(r.image)]
            : r.text
        }))
      })
    } else {
      for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.call.id, content: r.text })
      }
      const imgs = results.filter((r) => r.image)
      if (imgs.length) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: '（下面是工具读取的页面截图，供识别图表、公式和文字层遗漏的内容。）' },
            ...imgs.map((r) => ({ type: 'image_url', image_url: { url: r.image, detail: 'high' } }))
          ]
        })
      }
    }
  }

  // 轮次用尽：强制不再调工具，直接作答
  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })
  const merged = mergeUsage(totalUsage, finalUsage)
  if (merged) merged.rounds = rounds
  return merged
}

export async function webResearch(prompt, { signal } = {}) {
  const sources = []
  let text = ''
  await streamChatWithTools(
    [
      {
        role: 'system',
        content:
          '你是联网检索助手。必须调用 deepseek_web_search 搜索（需要读具体链接时调用 deepseek_read_url），再根据检索结果回答。只给事实摘要和关键原文，不要凭记忆编造。尽量列出可引用的 URL。'
      },
      { role: 'user', content: prompt }
    ],
    (d) => {
      text += d
    },
    {
      signal,
      webSearch: true,
      onSources: (list) => {
        for (const x of list || []) {
          const c = x.url_citation || x
          if (c.url) sources.push({ url: c.url, title: c.title || c.url })
        }
      }
    }
  )
  return { text: text.trim(), sources }
}
