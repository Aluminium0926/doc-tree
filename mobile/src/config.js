// 移动端配置：localStorage
const KEY = 'dt:config'
const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-flash',
  visionModel: 'deepseek-flash',
  effort: 'high',
  temperature: 0.3
}

export function readConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeConfig(patch) {
  const next = { ...readConfig(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function publicConfig() {
  const c = readConfig()
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    visionModel: c.visionModel,
    effort: c.effort,
    hasKey: Boolean(c.apiKey),
    keyHint: c.apiKey ? c.apiKey.slice(0, 5) + '***' + c.apiKey.slice(-4) : ''
  }
}

export const EFFORTS = ['low', 'high', 'max']

export function thinkingParams(cfg, effort) {
  if (!/deepseek\.com/i.test(cfg.baseUrl)) return {}
  const level = EFFORTS.includes(effort) ? effort : cfg.effort
  return level ? { thinking: { type: 'enabled' }, reasoning_effort: level } : {}
}
