// A/B 测试思考强度：low / high / max 的延迟与思考量
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'data', 'config.json'), 'utf8'))
const base = cfg.baseUrl.replace(/\/+$/, '')

const QUESTION = '用三句话解释：为什么有机化学里"含碳"是必要但不充分条件？'
const efforts = ['low', 'high', 'max']

for (const effort of efforts) {
  const t0 = Date.now()
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      thinking: { type: 'enabled' },
      reasoning_effort: effort,
      messages: [{ role: 'user', content: QUESTION }]
    })
  })
  if (!res.ok) {
    console.log(effort, 'HTTP', res.status, (await res.text()).slice(0, 300))
    continue
  }
  const dec = new TextDecoder()
  let buf = ''
  let rChars = 0
  let cChars = 0
  let tFirstR = 0
  let tFirstC = 0
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const d = JSON.parse(data).choices?.[0]?.delta
        if (d?.reasoning_content) {
          if (!tFirstR) tFirstR = Date.now() - t0
          rChars += d.reasoning_content.length
        }
        if (d?.content) {
          if (!tFirstC) tFirstC = Date.now() - t0
          cChars += d.content.length
        }
      } catch {}
    }
  }
  console.log(
    `${effort.padEnd(4)} 首思考 ${String(tFirstR).padStart(5)}ms  首正文 ${String(tFirstC).padStart(5)}ms  总 ${String(Date.now() - t0).padStart(5)}ms  思考 ${rChars} 字  正文 ${cChars} 字`
  )
}
