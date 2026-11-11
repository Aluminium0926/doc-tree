// OpenAI 兼容端点：配置读写、非流式、流式（SSE 解析）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = process.env.DOCTREE_DATA || path.join(root, 'data')
const CONFIG = path.join(DATA, 'config.json')

const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-flash',
  visionModel: 'deepseek-flash',
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
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    visionModel: c.visionModel,
    effort: c.effort,
    hasKey: Boolean(c.apiKey),
    keyHint: hint
  }
}

// DeepSeek 官方端点的思考字段：thinking + reasoning_effort
function thinkingParams(cfg, effort) {
  if (!/deepseek\.com/i.test(cfg.baseUrl)) return {}
  const level = EFFORTS.includes(effort) ? effort : cfg.effort
  if (!level) return {}
  return { thinking: { type: 'enabled' }, reasoning_effort: level }
}

function headers(cfg) {
  return { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' }
}

function endpoint(cfg) {
  return cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions'
}

function explain(status, body) {
  const snippet = String(body || '').slice(0, 400)
  if (status === 401) return `鉴权失败（401）：API Key 无效或已过期。${snippet}`
  if (status === 402) return `余额不足（402）。${snippet}`
  if (status === 429) return `触发限流（429），稍后再试。${snippet}`
  return `上游返回 ${status}：${snippet}`
}

export async function chat(messages, { maxTokens = 600, temperature, effort } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const res = await fetch(endpoint(cfg), {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: maxTokens,
      temperature: temperature ?? cfg.temperature,
      ...thinkingParams(cfg, effort)
    })
  })
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const j = await res.json()
  return j.choices?.[0]?.message?.content || ''
}

export async function streamChat(messages, onDelta, { signal, model, onReasoning } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')

  const res = await fetch(endpoint(cfg), {
    method: 'POST',
    headers: headers(cfg),
    signal,
    body: JSON.stringify({
      model: model || cfg.model,
      messages,
      stream: true,
      temperature: cfg.temperature,
      ...thinkingParams(cfg)
    })
  })
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
        const delta = j.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content)
        if (delta.content) onDelta(delta.content)
      } catch {}
    }
  }
}
