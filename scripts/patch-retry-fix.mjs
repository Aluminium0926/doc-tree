import fs from 'node:fs'
const F = 'lib/llm.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("      const res = await fetchWithRetry(url, opts)\n      const retryable", "      const res = await fetch(url, opts)\n      const retryable")
fs.writeFileSync(F, t)
console.log('recursion fixed')
