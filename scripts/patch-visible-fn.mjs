import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  const re = /function visibleDSML\(s\) \{[\s\S]*?\n\}/
  const fn = `function visibleDSML(s) {
  const src = String(s || '')
  const at = src.search(/<\\s*[|｜]\\s*[|｜]\\s*DSML/i)
  let head = at >= 0 ? src.slice(0, at) : src
  for (const p of ['<|DSML|', '<|DSML', '<|DSM', '<|DS', '<|D', '<|', '<｜DSML｜', '<｜DSML', '<｜DSM', '<｜DS', '<｜D', '<｜', '<']) {
    if (head.endsWith(p)) {
      head = head.slice(0, head.length - p.length)
      break
    }
  }
  return stripDSML(head)
}`
  t = t.replace(re, fn)
  fs.writeFileSync(F, t)
}
console.log('visibleDSML replaced')
