// 思考强度基准：4 条件 × N 轮，轮内随机顺序，取中位数
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'data', 'config.json'), 'utf8'))
const base = cfg.baseUrl.replace(/\/+$/, '')

const ROUNDS = Number(process.argv[2] || 5)
const QUESTION =
  '一份复习提纲里，作者把「考试时间、范围、题型分值」放在最前面，然后才是各章知识点。用四句话解释这种编排的理由。'

const CONDITIONS = [
  { name: 'default', params: {} },
  { name: 'low', params: { thinking: { type: 'enabled' }, reasoning_effort: 'low' } },
  { name: 'high', params: { thinking: { type: 'enabled' }, reasoning_effort: 'high' } },
  { name: 'max', params: { thinking: { type: 'enabled' }, reasoning_effort: 'max' } }
]

function shuffle(a) {
  const r = a.slice()
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

async function one(cond) {
  const t0 = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 180000)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: ac.signal,
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        messages: [{ role: 'user', content: QUESTION }],
        ...cond.params
      })
    })
    if (!res.ok) {
      const t = await res.text()
      return { name: cond.name, error: `${res.status} ${t.slice(0, 160)}` }
    }
    const dec = new TextDecoder()
    let buf = ''
    let rChars = 0
    let cChars = 0
    let tR = 0
    let tC = 0
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
          if (!d) continue
          if (d.reasoning_content) {
            if (!tR) tR = Date.now() - t0
            rChars += d.reasoning_content.length
          }
          if (d.content) {
            if (!tC) tC = Date.now() - t0
            cChars += d.content.length
          }
        } catch {}
      }
    }
    return { name: cond.name, tR, tC, total: Date.now() - t0, rChars, cChars }
  } catch (e) {
    return { name: cond.name, error: String(e.message || e) }
  } finally {
    clearTimeout(timer)
  }
}

// 预热，排除首次连接开销
await one(CONDITIONS[1])
console.log(`预热完成，开始 ${ROUNDS} 轮 × ${CONDITIONS.length} 条件\n`)

const rows = []
for (let round = 1; round <= ROUNDS; round++) {
  const order = shuffle(CONDITIONS)
  const line = []
  for (const cond of order) {
    const r = await one(cond)
    rows.push(r)
    if (r.error) line.push(`${r.name}:ERR`)
    else line.push(`${r.name}:${r.tC}ms/${r.rChars}字`)
    process.stdout.write(`第 ${round} 轮 ${line[line.length - 1]}  \n`)
  }
}

const med = (a) => {
  const s = a.slice().sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

console.log('\n=== 汇总（中位数，括号内为最小–最大）===')
console.log('条件     首正文(ms)              总时长(ms)              思考(字)')
for (const cond of CONDITIONS) {
  const ok = rows.filter((r) => r.name === cond.name && !r.error)
  if (!ok.length) {
    console.log(cond.name.padEnd(8), '全部失败')
    continue
  }
  const tcs = ok.map((r) => r.tC).filter(Boolean)
  const totals = ok.map((r) => r.total)
  const rs = ok.map((r) => r.rChars)
  const f = (arr) => `${med(arr)} (${Math.min(...arr)}–${Math.max(...arr)})`
  console.log(
    cond.name.padEnd(8),
    f(tcs).padEnd(24),
    f(totals).padEnd(24),
    f(rs)
  )
}

const errs = rows.filter((r) => r.error)
if (errs.length) console.log('\n失败样本:', errs.slice(0, 3))

fs.writeFileSync(path.join(root, 'scripts', 'effort-bench.json'), JSON.stringify(rows, null, 2))
console.log('\n原始数据: scripts/effort-bench.json')
