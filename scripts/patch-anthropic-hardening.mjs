import fs from 'node:fs'
const F = 'mobile/src/llm.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "function authHeaders(cfg, provider, format) {\n  const key = provider?.apiKey || cfg.apiKey\n  if (format === 'anthropic') {\n    return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }\n  }\n  return { authorization: `Bearer ${key}` }\n}",
  "function authHeaders(cfg, provider, format, direct) {\n  const key = provider?.apiKey || cfg.apiKey\n  if (format === 'anthropic') {\n    const h = { 'x-api-key': key, 'anthropic-version': '2023-06-01' }\n    if (direct) h['anthropic-dangerous-direct-browser-access'] = 'true'\n    return h\n  }\n  return { authorization: `Bearer ${key}` }\n}"
)
t = t.replace("    ...authHeaders(cfg, provider, format),\n    'content-type': 'application/json',\n    'x-target': endpointFor(cfg, provider)", "    ...authHeaders(cfg, provider, format, false),\n    'content-type': 'application/json',\n    'x-target': endpointFor(cfg, provider)")
t = t.replace("  return { ...authHeaders(cfg, provider, format), 'content-type': 'application/json' }", "  return { ...authHeaders(cfg, provider, format, true), 'content-type': 'application/json' }")
fs.writeFileSync(F, t)
console.log('mobile headers patched')

for (const file of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let s = fs.readFileSync(file, 'utf8')
  s = s.replace(
    "        stream: true,\n        temperature: cfg.temperature,\n        ...thinkingParams(cfg)",
    "        stream: true,\n        temperature: cfg.temperature,\n        max_tokens: 2048,\n        ...thinkingParams(cfg)"
  )
  s = s.replace(
    "          stream: true,\n          temperature: cfg.temperature,\n          ...thinkingParams(cfg)",
    "          stream: true,\n          temperature: cfg.temperature,\n          max_tokens: 2048,\n          ...thinkingParams(cfg)"
  )
  fs.writeFileSync(file, s)
}
console.log('max_tokens added')
