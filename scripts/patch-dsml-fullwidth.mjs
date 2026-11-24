import fs from 'node:fs'

for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')

  // 1) 加全角/半角归一化
  if (!t.includes('function normalizeDSML')) {
    t = t.replace(
      'function stripDSML(s) {',
      `function normalizeDSML(s) {
  return String(s || '')
    .replace(/\\uFF1C/g, '<')
    .replace(/\\uFF1E/g, '>')
    .replace(/\\uFF5C/g, '|')
    .replace(/\\uFF0F/g, '/')
    .replace(/\\uFF02/g, '"')
    .replace(/\\uFF1D/g, '=')
}

function stripDSML(s) {`
    )
  }

  // 2) stripDSML 先归一化
  t = t.replace('function stripDSML(s) {\n  return String(s || \'\')', "function stripDSML(s) {\n  return normalizeDSML(s)")

  // 3) visibleDSML 用归一化后的文本判断
  t = t.replace(
    /function visibleDSML\(s\) \{[\s\S]*?\n\}/,
    `function visibleDSML(s) {
  const src = normalizeDSML(s)
  const at = src.search(/<\\s*[|｜]\\s*[|｜]\\s*DSML/i)
  let head = at >= 0 ? src.slice(0, at) : src
  for (const p of ['<|DSML|', '<|DSML', '<|DSM', '<|DS', '<|D', '<|', '<']) {
    if (head.endsWith(p)) {
      head = head.slice(0, head.length - p.length)
      break
    }
  }
  return stripDSML(head)
}`
  )

  // 4) parseDSMLCalls 也归一化
  t = t.replace('function parseDSMLCalls(s) {\n  const calls = []', "function parseDSMLCalls(s) {\n  const calls = []\n  s = normalizeDSML(s)")

  fs.writeFileSync(F, t)
}
console.log('fullwidth dsml support added')
