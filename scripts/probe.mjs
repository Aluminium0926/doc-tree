// 连通性探测：列出模型 → 发一次极小的流式请求
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'data', 'config.json'), 'utf8'))
const base = cfg.baseUrl.replace(/\/+$/, '')
const key = cfg.apiKey

console.log('baseUrl =', base)
console.log('key len =', key.length, '(应为 35)')

const h = { authorization: `Bearer ${key}`, 'content-type': 'application/json' }

let r = await fetch(`${base}/models`, { headers: h })
console.log('\n[GET /models]', r.status)
const txt = await r.text()
console.log(txt.slice(0, 800))

if (!r.ok) process.exit(1)

r = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({
    model: cfg.model,
    stream: true,
    max_tokens: 40,
    messages: [{ role: 'user', content: '用四个字回答：你好吗' }]
  })
})
console.log('\n[POST /chat/completions stream]', r.status)
if (!r.ok) {
  console.log((await r.text()).slice(0, 800))
  process.exit(1)
}
const dec = new TextDecoder()
let out = ''
for await (const chunk of r.body) {
  out += dec.decode(chunk, { stream: true })
}
const pieces = out.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6))
let content = ''
for (const p of pieces) {
  if (p === '[DONE]') continue
  try {
    const j = JSON.parse(p)
    content += j.choices?.[0]?.delta?.content ?? ''
  } catch {}
}
console.log('stream ok, content =', JSON.stringify(content))
