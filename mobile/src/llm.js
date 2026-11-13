// 移动端模型调用：统一走本地代理（/proxy/llm），避免浏览器 CORS
import { readConfig, thinkingParams } from './config.js'

function targetOf(cfg) {
  return cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions'
}

function headers(cfg) {
  return {
    authorization: `Bearer ${cfg.apiKey}`,
    'content-type': 'application/json',
    'x-target': targetOf(cfg)
  }
}

function explain(status, body) {
  const snippet = String(body || '').slice(0, 400)
  if (status === 401) return `鉴权失败（401）：API Key 无效或已过期。${snippet}`
  if (status === 402) return `余额不足（402）。${snippet}`
  if (status === 429) return `触发限流（429），稍后再试。${snippet}`
  return `上游返回 ${status}：${snippet}`
}

export async function chat(messages, { maxTokens = 700, effort } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const res = await fetch('/proxy/llm', {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: maxTokens,
      temperature: cfg.temperature,
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

  const res = await fetch('/proxy/llm', {
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
