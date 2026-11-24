import fs from 'node:fs'
// server
let s = fs.readFileSync('server.mjs', 'utf8')
s = s.replace(
  "    const cfg = llm.readConfig()\n    if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })\n    let reply = ''",
  "    if (/^(清除|清空).*指令$/.test(text)) {\n      doc.instructions = []\n      await store.saveDoc(doc)\n      return json(res, 200, { ok: true, count: 0, reply: '已清除所有指令' })\n    }\n    const cfg = llm.readConfig()\n    if (!cfg.apiKey) return json(res, 400, { error: '未配置 API Key' })\n    let reply = ''"
)
fs.writeFileSync('server.mjs', s)

// mobile
let m = fs.readFileSync('mobile/src/api.js', 'utf8')
m = m.replace(
  "    const cfg = readConfig()\n    if (!cfg.apiKey) return json({ error: '未配置 API Key' }, 400)\n    let reply = ''",
  "    if (/^(清除|清空).*指令$/.test(text)) {\n      doc.instructions = []\n      await db.saveDoc(doc)\n      return json({ ok: true, count: 0, reply: '已清除所有指令' })\n    }\n    const cfg = readConfig()\n    if (!cfg.apiKey) return json({ error: '未配置 API Key' }, 400)\n    let reply = ''"
)
fs.writeFileSync('mobile/src/api.js', m)
console.log('clear instruction command ok')
