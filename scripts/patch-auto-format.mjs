import fs from 'node:fs'
for (const F of ['lib/llm.mjs','mobile/src/llm.js']) {
  let t=fs.readFileSync(F,'utf8')
  t=t.replace(
    "  const format = resolveFormat(base, provider?.format ?? cfg.apiFormat)",
    "  const explicitFormat = provider?.format && provider.format !== 'auto' ? provider.format : cfg.apiFormat\n  const format = resolveFormat(base, explicitFormat)"
  )
  fs.writeFileSync(F,t)
}
console.log('auto format fallback ok')
