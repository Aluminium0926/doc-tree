import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    "    totalUsage = mergeUsage(totalUsage, round.usage)\n    if (!round.calls.length) return totalUsage",
    "    totalUsage = mergeUsage(totalUsage, round.usage)\n    if (!round.calls.length) {\n      if (totalUsage) totalUsage.rounds = rounds\n      return totalUsage\n    }"
  )
  t = t.replace(
    "  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })\n  return mergeUsage(totalUsage, finalUsage)",
    "  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })\n  const merged = mergeUsage(totalUsage, finalUsage)\n  if (merged) merged.rounds = rounds\n  return merged"
  )
  t = t.replace(
    "  await streamChat(messages, onDelta, { signal, model, onReasoning, provider })\n}",
    "  const finalUsage = await streamChat(messages, onDelta, { signal, model, onReasoning, provider })\n  const merged = mergeUsage(totalUsage, finalUsage)\n  if (merged) merged.rounds = rounds\n  return merged\n}"
  )
  fs.writeFileSync(F, t)
}
// UI: usage 事件要取消 hidden
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace(
  "      const el = card?.querySelector('.node-usage')\n      if (el) el.textContent = usageLine(node.usage)",
  "      const el = card?.querySelector('.node-usage')\n      if (el) {\n        el.textContent = usageLine(node.usage)\n        el.hidden = !el.textContent\n      }"
)
fs.writeFileSync('public/app.js', a)
console.log('rounds + usage unhide fixed')
