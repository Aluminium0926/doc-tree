// 打印原始 SSE 前若干帧，确认 delta 结构（content / reasoning_content）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'data', 'config.json'), 'utf8'))
const base = cfg.baseUrl.replace(/\/+$/, '')

const res = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: cfg.model,
    stream: true,
    messages: [{ role: 'user', content: '说一句话：你好' }]
  })
})
console.log('status', res.status)

const dec = new TextDecoder()
let buf = ''
let n = 0
for await (const chunk of res.body) {
  buf += dec.decode(chunk, { stream: true })
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    if (n++ < 12) console.log(n, line.slice(0, 400))
  }
  if (n > 12) break
}
