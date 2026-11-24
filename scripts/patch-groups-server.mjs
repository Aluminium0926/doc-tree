import fs from 'node:fs'
const F = 'server.mjs'
let t = fs.readFileSync(F, 'utf8')

t = t.replace(
  "return json(res, 200, { docs: await store.listDocs(), config: llm.publicConfig(), serverVersion: SERVER_VERSION })",
  "return json(res, 200, { docs: await store.listDocs(), groups: await store.listGroups(), config: llm.publicConfig(), serverVersion: SERVER_VERSION })"
)

const routes = `
  if (p === '/api/group' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    const ids = Array.isArray(body.docIds) ? body.docIds.filter(Boolean).slice(0, 50) : []
    if (ids.length < 2) return json(res, 400, { error: '至少选择两份文档' })
    const g = await store.createGroup(String(body.name || '').trim(), ids)
    return json(res, 200, { group: g })
  }

  if (p === '/api/group/update' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    const g = await store.updateGroup(body.id, {
      name: body.name,
      add: Array.isArray(body.add) ? body.add : [],
      remove: Array.isArray(body.remove) ? body.remove : []
    })
    if (!g) return json(res, 404, { error: '组不存在' })
    return json(res, 200, { group: g })
  }

  if (p === '/api/group/dissolve' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}')
    await store.dissolveGroup(body.id)
    return json(res, 200, { ok: true })
  }
`
t = t.replace("  if (p === '/api/doc/restore' && req.method === 'POST') {", routes.trimStart() + "\n  if (p === '/api/doc/restore' && req.method === 'POST') {")

t = t.replace(
  "  const doc = await store.getDoc(body.docId)\n  if (!doc) return json(res, 404, { error: '文档不存在' })",
  "  const doc = await store.getDoc(body.docId)\n  if (!doc) return json(res, 404, { error: '文档不存在' })\n  const group = await store.groupOfDoc(doc.id)\n  let docs = [doc]\n  if (group) {\n    docs = (await Promise.all(group.docIds.map((id) => store.getDoc(id)))).filter(Boolean)\n  }"
)
t = t.replace(
  "    const messages = buildAskMessages({ doc, tree, node, image: body.image })",
  "    const messages = buildAskMessages({ docs, tree, node, image: body.image })"
)
fs.writeFileSync(F, t)
console.log('server groups patched')
