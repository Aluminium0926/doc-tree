import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes("p === '/api/group/update'")) {
  const route = `  if (p === '/api/group/update' && method === 'POST') {
    const body = await bodyJson(init)
    const groups = readGroups()
    const g = groups.find((x) => x.id === body.id)
    const add = Array.isArray(body.add) ? body.add : []
    const remove = Array.isArray(body.remove) ? body.remove : []
    if (!g) return json({ group: null, dissolved: true })
    const tree = await db.getTree('group:' + g.id)
    for (const docId of remove) {
      await db.saveTree(docId, tree)
    }
    g.docIds = g.docIds.filter((d) => !remove.includes(d))
    for (const docId of add) {
      const own = await db.getTree(docId)
      Object.assign(tree.nodes, own.nodes || {})
      for (const other of groups) if (other.id !== g.id) other.docIds = other.docIds.filter((d) => d !== docId)
      if (!g.docIds.includes(docId)) g.docIds.push(docId)
    }
    await db.saveTree('group:' + g.id, tree)
    // 少于 2 份自动解散
    for (const x of [...groups]) {
      if (x.docIds.length >= 2) continue
      const tx = await db.getTree('group:' + x.id)
      for (const docId of x.docIds) await db.saveTree(docId, tx)
      groups.splice(groups.indexOf(x), 1)
    }
    writeGroups(groups)
    return json({ group: groups.find((x) => x.id === g.id) || null, dissolved: !groups.some((x) => x.id === g.id) })
  }

`
  t = t.replace("  if (p === '/api/group/dissolve' && method === 'POST') {", route + "  if (p === '/api/group/dissolve' && method === 'POST') {")
  fs.writeFileSync(F, t)
}
console.log('mobile group update route added')
