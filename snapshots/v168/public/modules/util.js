// 通用小工具（前后端无关的纯函数 + DOM 选择器）
export const $ = (s, r = document) => r.querySelector(s)

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const trunc = (s, n) => {
  s = String(s || '')
  return s.length > n ? s.slice(0, n) + '…' : s
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function formatTokens(n) {
  const v = Number(n) || 0
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k'
  return String(v)
}

export function usageLine(u) {
  if (!u) return ''
  const parts = []
  if (u.input) parts.push(`输入 ${formatTokens(u.input)}`)
  if (u.cacheHit) parts.push(`缓存 ${formatTokens(u.cacheHit)}`)
  if (u.output) parts.push(`输出 ${formatTokens(u.output)}`)
  return parts.join(' · ')
}
