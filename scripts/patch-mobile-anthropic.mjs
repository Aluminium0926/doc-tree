import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl']) {",
  "    for (const k of ['baseUrl', 'model', 'visionModel', 'visionBaseUrl', 'apiFormat', 'visionFormat']) {"
)
t = t.replace(
  "  const provider = body.image ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey } : null",
  "  const provider = body.image\n    ? { baseUrl: cfg.visionBaseUrl || cfg.baseUrl, apiKey: cfg.visionApiKey || cfg.apiKey, format: cfg.visionFormat }\n    : null"
)
fs.writeFileSync(F, t)
console.log('api patched')
