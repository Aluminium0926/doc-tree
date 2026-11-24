import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes("'/api/instruction'")) {
  const route = `  if (p === '/api/instruction' && method === 'POST') {
    const body = await bodyJson(init)
    const doc = await db.getDoc(body.docId)
    if (!doc) return json({ error: '文档不存在' }, 404)
    const text = String(body.text || '').trim().slice(0, 500)
    if (!text) return json({ error: '指令不能为空' }, 400)
    const cfg = readConfig()
    if (!cfg.apiKey) return json({ error: '未配置 API Key' }, 400)
    let reply = ''
    try {
      const s = await chat(
        [
          { role: 'system', content: '你是「文档树」的指令接收器。用户会给出关于后续回答方式的指令。只回复一句简短确认（不超过 20 字），不要解释、不要重复指令。' },
          { role: 'user', content: text }
        ],
        { maxTokens: 60 }
      )
      reply = String(s || '').trim().slice(0, 60)
    } catch {}
    doc.instructions = [...(doc.instructions || []), text].slice(-20)
    await db.saveDoc(doc)
    return json({ ok: true, count: doc.instructions.length, reply })
  }

`
  t = t.replace("  if (p === '/api/ask' && method === 'POST')", route + "  if (p === '/api/ask' && method === 'POST')")
  fs.writeFileSync(F, t)
}
console.log('mobile instruction route ok')
