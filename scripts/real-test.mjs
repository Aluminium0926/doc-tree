// 真实端点验证：中文 PDF 划词讲解 + 截图/图片提问
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:4317'

async function importFile(file) {
  const buf = fs.readFileSync(file)
  const r = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent(path.basename(file)) },
    body: buf
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error)
  return j.doc.id
}

async function ask(docId, { anchor, question, image, parentId } = {}) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, anchor, question, image, parentId })
  })
  if (!res.ok) throw new Error(await res.text())

  const dec = new TextDecoder()
  let buf = ''
  let answer = ''
  let reasoning = 0
  let firstDeltaAt = 0
  let node = null

  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        const ev = JSON.parse(line.slice(5).trim())
        if (ev.type === 'meta') node = ev.node
        else if (ev.type === 'reasoning') reasoning += ev.text.length
        else if (ev.type === 'delta') {
          if (!firstDeltaAt) firstDeltaAt = Date.now()
          answer += ev.text
        } else if (ev.type === 'error') throw new Error(ev.message)
        else if (ev.type === 'done') node = ev.node
      }
    }
  }
  return { node, answer, reasoning, total: Date.now() - t0, firstDelta: firstDeltaAt ? firstDeltaAt - t0 : 0 }
}

const file = process.argv[2]
const docId = await importFile(file)
console.log('导入:', docId)

const d = await fetch(`${BASE}/api/doc/${docId}`).then((r) => r.json())
const page1 = d.doc.pages[0].text
const quote = page1.slice(0, 80).replace(/\n/g, ' ')
console.log('摘要:', (d.doc.summary || '(空)').slice(0, 120))

const r1 = await ask(docId, {
  anchor: { kind: 'doc', page: 1, quote },
  question: '这一段在讲什么？为什么放在第一章开头？'
})
console.log(`\n=== 划词讲解 === 首字 ${r1.firstDelta}ms / 总 ${r1.total}ms / 思考 ${r1.reasoning} 字`)
console.log(r1.answer.slice(0, 1200))

// 图片提问
const png = fs.readFileSync('docs/demo.png')
const r2 = await ask(docId, {
  anchor: { kind: 'image', page: 1, quote: '（框选区域）' },
  question: '这张截图里的界面，左侧栏和右侧栏分别是什么？只说你看到的。',
  image: 'data:image/png;base64,' + png.toString('base64')
})
console.log(`\n=== 图片提问 === 首字 ${r2.firstDelta}ms / 总 ${r2.total}ms / 思考 ${r2.reasoning} 字`)
console.log(r2.answer.slice(0, 900))
