import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  for (const m of qText.matchAll(/(?:第\\s*|page\\s*|p\\.?\\s*)(\\d{1,4})\\s*页?/gi)) {\n    const n = Number(m[1])\n    if (n > 0) refs.add(n)\n  }",
  "  for (const m of qText.matchAll(/(\\d{1,4})\\s*页/g)) {\n    const n = Number(m[1])\n    if (n > 0) refs.add(n)\n  }\n  for (const m of qText.matchAll(/(?:page|p\\.?)\\s*(\\d{1,4})/gi)) {\n    const n = Number(m[1])\n    if (n > 0) refs.add(n)\n  }\n  if (refs.size > 8) refs.clear()"
)
fs.writeFileSync(F, t)
console.log(t.includes('(\\\\d{1,4})\\\\s*页') || t.includes('(\\d{1,4})\\s*页') ? 'regex ok' : 'check')
