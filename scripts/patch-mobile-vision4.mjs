import fs from 'node:fs'
const F = 'mobile/src/llm.js'
let t = fs.readFileSync(F, 'utf8')

// chat() 没有 provider，恢复原判断
t = t.replace(
  "export async function chat(messages, { maxTokens = 700, effort } = {}) {\n  const cfg = readConfig()\n  if (!cfg.apiKey && !provider?.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')",
  "export async function chat(messages, { maxTokens = 700, effort } = {}) {\n  const cfg = readConfig()\n  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')"
)

// streamChat 支持只用视觉 Key
t = t.replace(
  "export async function streamChat(messages, onDelta, { signal, model, onReasoning, provider } = {}) {\n  const cfg = readConfig()\n  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')",
  "export async function streamChat(messages, onDelta, { signal, model, onReasoning, provider } = {}) {\n  const cfg = readConfig()\n  if (!cfg.apiKey && !provider?.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')"
)

fs.writeFileSync(F, t)
console.log('ok')
