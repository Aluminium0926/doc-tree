// 单次提问：node scripts/ask-one.mjs <docId> "<问题>" [页码]
const BASE = 'http://127.0.0.1:4317'
const [docId, question, pageArg] = process.argv.slice(2)
const page = Number(pageArg || 1)

const d = await fetch(`${BASE}/api/doc/${docId}`).then((r) => r.json())
const text = (d.doc.pages.find((p) => p.no === page) || d.doc.pages[0]).text
const quote = text.slice(0, 120).replace(/\n/g, ' ')

const res = await fetch(`${BASE}/api/ask`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ docId, anchor: { kind: 'doc', page, quote }, question })
})
const dec = new TextDecoder()
let buf = ''
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
        if (ev.type === 'delta') process.stdout.write(ev.text)
        if (ev.type === 'error') console.log('\n[错误]', ev.message)
      } catch {}
    }
  }
}
console.log('\n')
