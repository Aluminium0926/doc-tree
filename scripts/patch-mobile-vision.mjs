import fs from 'node:fs'

const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')

// 配置接口：接受视觉端点与视觉 Key
t = t.replace(
  "    for (const k of ['baseUrl', 'model', 'visionModel']) {",
  "    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl']) {"
)
t = t.replace(
  "    if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()",
  "    if (typeof body.apiKey === 'string' && body.apiKey.trim()) patch.apiKey = body.apiKey.trim()\n    if (typeof body.visionApiKey === 'string' && body.visionApiKey.trim()) patch.visionApiKey = body.visionApiKey.trim()\n    if (body.visionBaseUrl === '') patch.visionBaseUrl = ''"
)

// 提问：截图走视觉模型 + 独立的端点/Key
t = t.replace(
  "  const useModel = body.image && cfg.visionModel ? cfg.visionModel : cfg.model",
  "  const useModel = body.image ? cfg.visionModel || cfg.model : cfg.model\n  const provider = body.image ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey } : null"
)

// streamChat 调用里加 provider
t = t.replace(
  "      await streamChat(\n        messages,",
  "      await streamChat(\n        messages,"
)
t = t.replace(
  "        {\n          signal: ac.signal,\n          model: useModel,",
  "        {\n          signal: ac.signal,\n          model: useModel,\n          provider,"
)

fs.writeFileSync(F, t)
console.log('patched')
