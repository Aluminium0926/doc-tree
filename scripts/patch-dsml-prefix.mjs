import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    `function visibleDSML(s) {
  const src = String(s || '')
  const at = src.search(/<\\s*[|｜]\\s*[|｜]\\s*DSML/i)
  const head = at >= 0 ? src.slice(0, at) : src
  return stripDSML(head)
}`,
    `function visibleDSML(s) {
  const src = String(s || '')
  const at = src.search(/<\\s*[|｜]\\s*[|｜]\\s*DSML/i)
  let head = at >= 0 ? src.slice(0, at) : src
  // 流式分块可能停在标记中间（例如 "<|DS"），先把疑似前缀藏起来
  for (const p of ['<|DSML|', '<|DSML', '<|DSM', '<|DS', '<|D', '<|', '<｜DSML｜', '<｜DSML', '<｜DSM', '<｜DS', '<｜D', '<｜', '<']) {
    if (head.endsWith(p)) {
      head = head.slice(0, head.length - p.length)
      break
    }
  }
  return stripDSML(head)
}`
  )
  fs.writeFileSync(F, t)
}
console.log('prefix guard ok')
