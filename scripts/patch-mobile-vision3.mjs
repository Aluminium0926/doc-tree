import fs from 'node:fs'
const F = 'mobile/src/llm.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("  if (!cfg.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')", "  if (!cfg.apiKey && !provider?.apiKey) throw new Error('未配置 API Key，请点右上角设置填写')")
fs.writeFileSync(F, t)
console.log('ok')
