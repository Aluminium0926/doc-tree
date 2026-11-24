import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes("'/api/ask/resume'")) {
  const route = `  if (p === '/api/ask/resume' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    const cfg = readConfig()
    if (!cfg.apiKey) return json({ error: '未配置 API Key' }, 400)
    const group = groupOfDoc(doc.id)
    let docs = [doc]
    if (group) docs = (await Promise.all(group.docIds.map((id) => db.getDoc(id)))).filter(Boolean)
    const tree = await docTree(body.docId)
    const node = tree.nodes[body.nodeId]
    if (!node) return json({ error: '这条回答不存在' }, 404)

    const messages = buildAskMessages({ docs, tree, node })
    messages.push({ role: 'assistant', content: node.answer || '（还没有任何内容）' })
    messages.push({ role: 'user', content: '（上面的回答被中断了。请从断点处继续写，不要重复已有内容，也不要重新开头。）' })

    return sseResponse(async (send) => {
      send({ type: 'meta', node })
      try {
        const usage = await streamChatWithTools(
          messages,
          (d) => {
            node.answer += d
            send({ type: 'delta', text: d })
          },
          {
            model: node.model || cfg.model,
            specs: TOOL_SPECS,
            exec: (name, args) => execTool(docs, doc.id, name, args),
            onTool: (t2) => send({ type: 'tool', name: t2.name, args: t2.args }),
            onReasoning: (t2) => {
              node.reasoning = (node.reasoning || '') + t2
              send({ type: 'reasoning', text: t2 })
            }
          }
        )
        if (usage) {
          const prev = node.usage || {}
          node.usage = {
            input: (prev.input || 0) + usage.input,
            output: (prev.output || 0) + usage.output,
            cacheHit: (prev.cacheHit || 0) + usage.cacheHit,
            cacheMiss: (prev.cacheMiss || 0) + usage.cacheMiss,
            total: (prev.total || 0) + usage.total,
            rounds: (prev.rounds || 0) + (usage.rounds || 1)
          }
          send({ type: 'usage', usage: node.usage })
        }
        delete node.stopped
      } catch (e) {
        node.stopped = true
        send({ type: 'stopped' })
      }
      if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)
      delete node.status
      await saveDocTree(body.docId, tree)
      send({ type: 'done', node })
    })
  }

`
  t = t.replace("  if (p === '/api/ask' && method === 'POST') return handleAsk(init)", route + "  if (p === '/api/ask' && method === 'POST') return handleAsk(init)")
  fs.writeFileSync(F, t)
}
console.log('mobile resume route ok')
