import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('async function refreshCurrentTree')) {
  t = t.replace(
    'async function resumeNode(id) {',
    `async function refreshCurrentTree() {
  if (!S.doc) return
  try {
    const d = await fetch('/api/doc/' + S.doc.id).then((r) => r.json())
    if (d && d.tree) {
      S.tree = d.tree
      renderTree()
    }
  } catch {}
}

async function resumeNode(id) {`
  )
}
t = t.replace(
  "    if (e && e.name === 'AbortError') setStatus('已停止')\n    else {\n      toast(e.message)\n      setStatus('')\n    }",
  "    if (e && e.name === 'AbortError') {\n      setStatus('已停止')\n      await refreshCurrentTree()\n    } else {\n      toast(e.message)\n      setStatus('')\n    }"
)
fs.writeFileSync(F, t)
console.log('refresh tree on abort ok')
