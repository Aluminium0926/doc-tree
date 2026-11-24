import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    ".replace(/<\\/?[^>]*?parameter[^>]*>/gi, '')\n}",
    ".replace(/<\\/?[^>]*?parameter[^>]*>/gi, '')\n    .trim()\n}"
  )
  fs.writeFileSync(F, t)
}
console.log('trim output ok')
