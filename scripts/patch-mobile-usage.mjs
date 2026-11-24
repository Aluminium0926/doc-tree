import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes("'/api/usage'")) {
  const route = `  if (p === '/api/usage' && method === 'GET') {
    const docs = await db.listDocsRaw()
    const groups = readGroups()
    const groupName = new Map(groups.map((g) => [g.id, g.name]))
    const seen = new Set()
    const totals = { input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0, rounds: 0 }
    const dayMap = new Map()
    const docMap = new Map()
    const dayKey = (t2) => {
      const d = new Date(t2)
      const p2 = (n) => String(n).padStart(2, '0')
      return \`\${d.getFullYear()}-\${p2(d.getMonth() + 1)}-\${p2(d.getDate())}\`
    }
    for (const doc of docs) {
      const key = doc.groupId || doc.id
      if (seen.has(key)) continue
      seen.add(key)
      const tree = await docTree(doc.id)
      for (const n of Object.values(tree.nodes || {})) {
        const u = n.usage
        if (!u) continue
        totals.input += u.input || 0
        totals.output += u.output || 0
        totals.cacheHit += u.cacheHit || 0
        totals.cacheMiss += u.cacheMiss || 0
        totals.total += u.total || (u.input || 0) + (u.output || 0)
        totals.requests += 1
        totals.rounds += u.rounds || 1
        const dk = dayKey(n.createdAt || Date.now())
        if (!dayMap.has(dk)) dayMap.set(dk, { date: dk, input: 0, output: 0, cacheHit: 0, cacheMiss: 0, total: 0, requests: 0 })
        const dd = dayMap.get(dk)
        dd.input += u.input || 0
        dd.output += u.output || 0
        dd.cacheHit += u.cacheHit || 0
        dd.cacheMiss += u.cacheMiss || 0
        dd.total += u.total || (u.input || 0) + (u.output || 0)
        dd.requests += 1
        if (!docMap.has(key)) docMap.set(key, { title: doc.groupId ? groupName.get(doc.groupId) || doc.title : doc.title, total: 0, cacheHit: 0, cacheMiss: 0, requests: 0 })
        const dm = docMap.get(key)
        dm.total += u.total || (u.input || 0) + (u.output || 0)
        dm.cacheHit += u.cacheHit || 0
        dm.cacheMiss += u.cacheMiss || 0
        dm.requests += 1
      }
    }
    const hitRate = totals.cacheHit + totals.cacheMiss > 0 ? totals.cacheHit / (totals.cacheHit + totals.cacheMiss) : 0
    return json({
      totals: { ...totals, hitRate },
      days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
      docs: [...docMap.values()].sort((a, b) => b.total - a.total).slice(0, 8)
    })
  }

`
  t = t.replace("  if (p === '/api/config' && method === 'POST')", route + "  if (p === '/api/config' && method === 'POST')")
  fs.writeFileSync(F, t)
}
console.log('mobile usage endpoint ok')
