import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    "  let buf = ''\n  let text = ''\n  const blocks = []",
    "  let buf = ''\n  let text = ''\n  let shown = ''\n  const blocks = []\n  const emit = (full) => {\n    const vis = visibleDSML(full)\n    if (vis.length > shown.length) {\n      onDelta(vis.slice(shown.length))\n      shown = vis\n    }\n  }"
  )
  t = t.replace(
    "          if (d.type === 'text_delta' && d.text) {\n            text += d.text\n            onDelta(d.text)\n          }",
    "          if (d.type === 'text_delta' && d.text) {\n            text += d.text\n            emit(text)\n          }"
  )
  t = t.replace(
    "  const calls = blocks\n    .filter(Boolean)\n    .map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))\n  return { text, calls }",
    "  const structured = blocks\n    .filter(Boolean)\n    .map((b) => ({ id: b.id, name: b.name, arguments: b.json || '{}' }))\n  const dsml = parseDSMLCalls(text)\n  return { text: stripDSML(text), calls: [...structured, ...dsml] }"
  )
  fs.writeFileSync(F, t)
}
console.log('anthropic filtered')
