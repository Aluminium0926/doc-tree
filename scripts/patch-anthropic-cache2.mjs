import fs from 'node:fs'
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.split('if (conv.system) body.system = conv.system').join("if (conv.system) body.system = [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }]")
  fs.writeFileSync(F, t)
}
console.log('all system blocks cached')
