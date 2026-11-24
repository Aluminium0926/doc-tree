// 冒烟测试：导入 → 读回 → 检查分页文本与摘要
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:4317'
const file = process.argv[2]
if (!file) {
  console.error('用法: node scripts/test-import.mjs <文件路径>')
  process.exit(1)
}
const buf = fs.readFileSync(file)
const name = path.basename(file)

const t0 = Date.now()
const r = await fetch(`${BASE}/api/import`, {
  method: 'POST',
  headers: { 'x-filename': encodeURIComponent(name) },
  body: buf
})
const j = await r.json()
console.log('import:', r.status, j)
if (!r.ok) process.exit(1)
console.log('耗时:', Date.now() - t0, 'ms')

const d = await fetch(`${BASE}/api/doc/${j.doc.id}`).then((x) => x.json())
console.log('页数:', d.doc.pages.length, '| 摘要长度:', (d.doc.summary || '').length)
for (const p of d.doc.pages.slice(0, 2)) {
  console.log(`\n--- 第 ${p.no} 页（${p.text.length} 字）---`)
  console.log(p.text.slice(0, 260))
}
console.log('\nid =', j.doc.id)

// 等摘要
for (let i = 0; i < 12; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  const dd = await fetch(`${BASE}/api/doc/${j.doc.id}`).then((x) => x.json())
  if (dd.doc.summary) {
    console.log('\n--- 摘要 ---\n' + dd.doc.summary.slice(0, 400))
    break
  }
}
