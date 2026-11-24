import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    "function stripDSML(s) {\n  return String(s || '')",
    "function stripDSML(s) {\n  return String(s || '')\n    .replace(/^\\s+/, '')"
  )
  fs.writeFileSync(F, t)
}
console.log('trim ok')
