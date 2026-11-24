import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "const mode = quote ? 'selection' : followAnswer ? 'follow' : free ? 'free' : 'page'",
  "const mode = followAnswer ? 'follow' : quote ? 'selection' : free ? 'free' : 'page'"
)
fs.writeFileSync(F, t)
console.log('follow priority fixed')
