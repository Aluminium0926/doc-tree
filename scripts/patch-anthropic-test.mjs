import fs from 'node:fs'
const F = 'scripts/anthropic-dsml-test.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()\n  const doc = st.docs.find((d) => d.kind === 'pdf' && d.pages >= 62)\n  const res",
  "  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()\n  const doc = st.docs.find((d) => d.kind === 'pdf' && d.pages >= 62)\n  const before = await (await fetch('http://127.0.0.1:4317/api/doc/' + doc.id)).json()\n  const beforeIds = new Set(Object.keys(before.tree.nodes))\n  const res"
)
t = t.replace(
  "  const nodes = Object.values(node.tree.nodes).sort((a, b) => a.createdAt - b.createdAt)\n  const last = nodes[nodes.length - 1]",
  "  const fresh = Object.values(node.tree.nodes).filter((n) => !beforeIds.has(n.id))\n  const last = fresh[fresh.length - 1] || {}"
)
fs.writeFileSync(F, t)
console.log('test patched')
