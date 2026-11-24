import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    "const at = src.search(/<\\s*[|｜]\\s*[|｜]\\s*DSML/i)",
    "const at = src.search(/<\\s*[|｜]\\s*(?:[|｜]\\s*)?DSML/i)"
  )
  fs.writeFileSync(F, t)
}
console.log('single-pipe support ok')
