// 真实链路基准：走 /api/ask（含摘要+检索+祖先链），3 轮 × 3 档
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:4317'
const ROUNDS = Number(process.argv[3] || 3)
const file = process.argv[2]

const buf = fs.readFileSync(file)
const imp = await fetch(`${BASE}/api/import`, {
  method: 'POST',
  headers: { 'x-filename': encodeURIComponent(path.basename(file)) },
  body: buf
}).then((r) => r.json())
const docId = imp.doc.id
console.log('导入:', docId)

// 等摘要生成完，保证上下文一致
for (let i = 0; i < 20; i++) {
  const d = await fetch(`${BASE}/api/doc/${docId}`).then((r) => r.json())
  if (d.doc.summary) {
    console.log('摘要就绪:', d.doc.summary.length, '字')
    break
  }
  await new Promise((r) => setTimeout(r, 1000))
}

const d = await fetch(`${BASE}/api/doc/${docId}`).then((r) => r.json())
const quote = d.doc.pages[0].text.slice(0, 80).replace(/\n/g, ' ')
const question = '这一段在讲什么？为什么放在第一章开头？'

async function setEffort(effort) {
  await fetch(`${BASE}/api/config`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ effort })
  })
}

async function ask() {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, anchor: { kind: 'doc', page: 1, quote }, question })
  })
  const dec = new TextDecoder()
  let buf = ''
  let tC = 0
  let rChars = 0
  let cChars = 0
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          const ev = JSON.parse(line.slice(5).trim())
          if (ev.type === 'reasoning') rChars += ev.text.length
          if (ev.type === 'delta') {
            if (!tC) tC = Date.now() - t0
            cChars += ev.text.length
          }
          if (ev.type === 'error') throw new Error(ev.message)
        } catch (e) {
          if (e.message && !e.message.startsWith('Unexpected')) throw e
        }
      }
    }
  }
  return { tC, total: Date.now() - t0, rChars, cChars }
}

const efforts = ['low', 'high', 'max']
const rows = []
for (let round = 1; round <= ROUNDS; round++) {
  for (const effort of efforts) {
    await setEffort(effort)
    const r = await ask()
    r.effort = effort
    rows.push(r)
    console.log(`第 ${round} 轮 ${effort.padEnd(4)} 首正文 ${r.tC}ms 总 ${r.total}ms 思考 ${r.rChars} 字 正文 ${r.cChars} 字`)
  }
}

const med = (a) => {
  const s = a.slice().sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}
console.log('\n=== 真实上下文汇总（中位数，括号最小–最大）===')
for (const effort of efforts) {
  const ok = rows.filter((r) => r.effort === effort)
  const f = (arr) => `${med(arr)} (${Math.min(...arr)}–${Math.max(...arr)})`
  console.log(
    effort.padEnd(5),
    f(ok.map((r) => r.tC)).padEnd(20),
    f(ok.map((r) => r.total)).padEnd(20),
    f(ok.map((r) => r.rChars))
  )
}

await setEffort('high')
await fetch(`${BASE}/api/doc/${docId}`, { method: 'DELETE' })
console.log('\n已恢复 high 并删除测试文档')
