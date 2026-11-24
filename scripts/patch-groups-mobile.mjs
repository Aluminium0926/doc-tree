import fs from 'node:fs'

const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')

// 1) 把组内文档的树路由到 group:<id>
t = t.split('db.getTree(').join('docTree(')
t = t.split('db.saveTree(').join('saveDocTree(')

// 2) 组工具函数（放在 handleApi 之前）
const helpers = `// ---------- 文档组（移动端：localStorage + 组树存 trees 库） ----------
const GROUPS_KEY = 'dt:groups'
function readGroups() {
  try {
    const g = JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]')
    return Array.isArray(g) ? g : []
  } catch {
    return []
  }
}
function writeGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}
function groupOfDoc(docId) {
  return readGroups().find((g) => g.docIds.includes(docId)) || null
}
async function docTree(docId) {
  const g = groupOfDoc(docId)
  return db.getTree(g ? 'group:' + g.id : docId)
}
async function saveDocTree(docId, tree) {
  const g = groupOfDoc(docId)
  await db.saveTree(g ? 'group:' + g.id : docId, tree)
}

`
t = t.replace('async function handleApi(path, init) {', helpers + 'async function handleApi(path, init) {')

// 3) state 带上组与 groupId
t = t.replace(
  "    return json({ docs: await db.listDocs(), config: publicConfig() })",
  `    const groups = readGroups()
    const docs = (await db.listDocs()).map((d) => ({
      ...d,
      groupId: groups.find((g) => g.docIds.includes(d.id))?.id || null
    }))
    return json({ docs, groups, config: publicConfig() })`
)

// 4) 组接口
const routes = `  if (p === '/api/group' && method === 'POST') {
    const body = await bodyJson(init)
    const ids = Array.isArray(body.docIds) ? body.docIds.filter(Boolean).slice(0, 50) : []
    if (ids.length < 2) return json({ error: '至少选择两份文档' }, 400)
    const groups = readGroups()
    const id = hex(4)
    const nodes = {}
    for (const docId of ids) {
      const own = await db.getTree(docId)
      Object.assign(nodes, own.nodes || {})
    }
    await db.saveTree('group:' + id, { nodes })
    for (const g of groups) g.docIds = g.docIds.filter((d) => !ids.includes(d))
    const kept = groups.filter((g) => g.docIds.length >= 2)
    kept.push({ id, name: String(body.name || '').trim() || \`组 \${kept.length + 1}\`, docIds: [...ids], createdAt: Date.now() })
    writeGroups(kept)
    return json({ group: kept[kept.length - 1] })
  }

  if (p === '/api/group/dissolve' && method === 'POST') {
    const body = await bodyJson(init)
    const groups = readGroups()
    const g = groups.find((x) => x.id === body.id)
    if (!g) return json({ error: '组不存在' }, 404)
    const tree = await db.getTree('group:' + g.id)
    for (const docId of g.docIds) await db.saveTree(docId, tree)
    writeGroups(groups.filter((x) => x.id !== g.id))
    return json({ ok: true })
  }

`
t = t.replace("  if (p === '/api/doc/restore' && method === 'POST') {", routes + "  if (p === '/api/doc/restore' && method === 'POST') {")

// 5) handleAsk：组内多文档上下文
t = t.replace(
  "  const doc = await db.getDoc(body.docId)\n  if (!doc) return json({ error: '文档不存在' }, 404)\n\n  if (!doc.summary) makeSummary(doc)\n\n  const tree = await docTree(body.docId)",
  "  const doc = await db.getDoc(body.docId)\n  if (!doc) return json({ error: '文档不存在' }, 404)\n\n  if (!doc.summary) makeSummary(doc)\n\n  const group = groupOfDoc(doc.id)\n  let docs = [doc]\n  if (group) docs = (await Promise.all(group.docIds.map((id) => db.getDoc(id)))).filter(Boolean)\n\n  const tree = await docTree(body.docId)"
)
t = t.replace("        buildAskMessages({ doc, tree, node, image: body.image })", "        buildAskMessages({ docs, tree, node, image: body.image })")

// 6) 删除文档时摘掉组成员
t = t.replace(
  "    if (m && method === 'DELETE') {\n      await db.setHidden(m[1], true)\n      return json({ ok: true, hidden: true })\n    }",
  `    if (m && method === 'DELETE') {
      await db.setHidden(m[1], true)
      const groups = readGroups()
      let changed = false
      for (const g of groups) {
        if (!g.docIds.includes(m[1])) continue
        g.docIds = g.docIds.filter((d) => d !== m[1])
        changed = true
      }
      if (changed) writeGroups(groups.filter((g) => g.docIds.length > 0))
      return json({ ok: true, hidden: true })
    }`
)

fs.writeFileSync(F, t)
console.log('mobile groups patched')
