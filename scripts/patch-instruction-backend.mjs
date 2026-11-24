import fs from 'node:fs'

// 1) server: 指令接口
let s = fs.readFileSync('server.mjs', 'utf8')
if (!s.includes("'/api/instruction'")) {
  const route = `  if (p === '/api/instruction' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const doc = await store.getDoc(body.docId)
    if (!doc) return json(res, 404, { error: '文档不存在' })
    const text = String(body.text || '').trim().slice(0, 500)
    if (!text) return json(res, 400, { error: '指令不能为空' })
    const cfg = llm.readConfig()
    if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })
    let reply = ''
    try {
      const s = await llm.chat(
        [
          { role: 'system', content: '你是「文档树」的指令接收器。用户会给出关于后续回答方式的指令。只回复一句简短确认（不超过 20 字），不要解释、不要重复指令。' },
          { role: 'user', content: text }
        ],
        { maxTokens: 60, effort: 'low' }
      )
      reply = String(s || '').trim().slice(0, 60)
    } catch {}
    doc.instructions = [...(doc.instructions || []), text].slice(-20)
    await store.saveDoc(doc)
    return json(res, 200, { ok: true, count: doc.instructions.length, reply })
  }

`
  s = s.replace("  if (p === '/api/ask' && req.method === 'POST')", route + "  if (p === '/api/ask' && req.method === 'POST')")
  fs.writeFileSync('server.mjs', s)
}

// 2) context: 把指令追加到 system
let t = fs.readFileSync('lib/context.mjs', 'utf8')
if (!t.includes('用户附加指令')) {
  t = t.replace(
    "  const content = []\n  if (image) content.push",
    `  const instr = all.flatMap((d) => d.instructions || []).filter(Boolean).slice(-10)
  const systemWithInstr = instr.length
    ? system + '\\n\\n【用户附加指令（优先遵守）】\\n' + instr.map((x, i) => \`\${i + 1}. \${x}\`).join('\\n')
    : system

  const content = []
  if (image) content.push`
  )
  t = t.replace("{ role: 'system', content: system },", "{ role: 'system', content: systemWithInstr },")
  fs.writeFileSync('lib/context.mjs', t)
}
console.log('instruction backend ok')
