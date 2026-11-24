// 验证：在你的文档上提问，检查是否仍生成应试辅助内容；测完删除该节点
const BASE = 'http://127.0.0.1:4317'
const [docId, pageArg, question = '请讲解这段内容'] = process.argv.slice(2)
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
let answer = ''
let nodeId = null
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
        if (ev.type === 'meta') nodeId = ev.node.id
        if (ev.type === 'delta') answer += ev.text
      } catch {}
    }
  }
}

console.log(answer.slice(0, 900))
console.log('\n--- 检查 ---')
for (const k of ['记忆抓手', '记忆口诀', '背诵表', '考点', '失分点', 'mnemonic', '在全文里的位置', '在全文中的作用', '在全文中的位置', '与前后页', '在全文里']) {
  console.log(answer.includes(k) ? `命中: ${k}` : `干净: ${k}`)
}
console.log('长度:', answer.length, '字')

if (nodeId) {
  await fetch(`${BASE}/api/node/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, nodeId })
  })
  console.log('已删除验证节点:', nodeId)
}
