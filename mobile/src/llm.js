// 模型调用：优先本地/服务端代理（/proxy/llm），不可用时直连 baseUrl（需服务端允许 CORS）
import { readConfig, thinkingParams } from './config.js'

function targetOf(cfg) {
  return cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions'
}

function proxyHeaders(cfg) {
  return {
    authorization: `Bearer ${cfg.apiKey}`,
    'content-type': 'application/json',
    'x-target': targetOf(cfg)
  }
}

function directHeaders(cfg) {
  return {
    authorization: `Bearer ${cfg.apiKey}`,
    'content-type': 'application/json'
  }
}

function explain(status, body) {
  const snippet = String(body || '').slice(0, 400)
  if (status === 401) return `鉴权失败（401）：API Key 无效或已过期。${snippet}`
  if (status === 402) return `余额不足（402）。${snippet}`
  if (status === 429) return `触发限流（429），稍后再试。${snippet}`
  return `上游返回 ${status}：${snippet}`
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

async function requestModel(cfg, payload, signal) {
  if (proxyState !== 'none') {
    try {
      const res = await fetch('/proxy/llm', {
        method: 'POST',
        headers: proxyHeaders(cfg),
        body: payload,
        signal
      })
      // 静态部署时 /proxy/llm 往往返回 404，或者被 SPA 兜底成 HTML
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
  return fetch(targetOf(cfg), {
    method: 'POST',
    headers: directHeaders(cfg),
    body: payload,
    signal
  })
}

export async function chat(messages, { maxTokens = 700, effort } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')
  const payload = JSON.stringify({
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
    throw new Error(`请求模型失败（${proxyState === 'none' ? '直连 ' + targetOf(cfg) : '本地代理'}）：${e.message}`)
  }
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const j = await res.json()
  return j.choices?.[0]?.message?.content || ''
}

export async function streamChat(messages, onDelta, { signal, model, onReasoning } = {}) {
  const cfg = readConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')

  const payload = JSON.stringify({
    model: model || cfg.model,
    messages,
    stream: true,
    temperature: cfg.temperature,
    ...thinkingParams(cfg)
  })

  let res
  try {
    res = await requestModel(cfg, payload, signal)
  } catch (e) {
    if (e && e.name === 'AbortError') throw e
    const where = proxyState === 'none' ? '直连 ' + targetOf(cfg) : '本地代理'
    throw new Error(`请求模型失败（${where}）：${e.message}。如果直连失败，通常是该端点不允许浏览器跨域，需要部署 /proxy/llm 代理。`)
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
        const delta = j.choices?.[0]?.delta
        if (!delta) continue
        if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content)
        if (delta.content) onDelta(delta.content)
      } catch {}
    }
  }
}
