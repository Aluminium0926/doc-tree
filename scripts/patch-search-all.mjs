import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')

// collectMatches 记录页内序号
a=a.replace(
`  for (const p of S.doc?.pages || []) {
    const hay = (p.text || '').toLowerCase()
    let i = 0
    while (out.length < 800 && (i = hay.indexOf(needle, i)) !== -1) {
      out.push({ page: p.no })
      i += Math.max(1, needle.length)
    }
  }`,
`  for (const p of S.doc?.pages || []) {
    const hay = (p.text || '').toLowerCase()
    let i = 0
    let ordinal = 0
    while (out.length < 800 && (i = hay.indexOf(needle, i)) !== -1) {
      out.push({ page: p.no, ordinal })
      ordinal++
      i += Math.max(1, needle.length)
    }
  }`
)

a=a.replace("    paintInPage(pageEl, q)", "    paintInPage(pageEl, q, m.ordinal || 0)")

// paintRects 改成追加，支持标记当前命中
a=a.replace(
`function paintRects(container, rects) {
  container.querySelectorAll('.search-hit').forEach((x) => x.remove())
  const cr = container.getBoundingClientRect()
  for (const r of rects) {
    if (!r.width || !r.height) continue
    const d = document.createElement('div')
    d.className = 'search-hit'`,
`function paintRects(container, rects, active = false) {
  const cr = container.getBoundingClientRect()
  for (const r of rects) {
    if (!r.width || !r.height) continue
    const d = document.createElement('div')
    d.className = 'search-hit' + (active ? ' current' : '')`
)

// 重写 paintInPage：一页内所有出现位置都画
const start=a.indexOf('function paintInPage(pageEl, q) {')
const end=a.indexOf('function paintInSheet(q) {', start)
if(start<0||end<0) throw new Error('markers')
const block=`function paintInPage(pageEl, q, activeOrdinal = 0) {
  if (!pageEl) return
  document.querySelectorAll('.page .search-hit').forEach((x) => x.remove())
  const layer = pageEl.querySelector('.textLayer')
  if (!layer) return
  const spans = [...layer.querySelectorAll('span')]
  let text = ''
  const starts = []
  for (const s of spans) {
    starts.push(text.length)
    text += s.textContent
  }
  const low = text.toLowerCase()
  const ql = q.toLowerCase()
  let i = 0
  let ordinal = 0
  while (ordinal < 200 && (i = low.indexOf(ql, i)) !== -1) {
    const end = i + q.length
    let si = 0
    while (si + 1 < spans.length && starts[si + 1] <= i) si++
    let ei = si
    while (ei + 1 < spans.length && starts[ei + 1] < end) ei++
    const sNode = spans[si]?.firstChild
    const eNode = spans[ei]?.firstChild
    if (sNode && eNode) {
      const range = document.createRange()
      try {
        range.setStart(sNode, Math.max(0, i - starts[si]))
        range.setEnd(eNode, Math.min(eNode.length, end - starts[ei]))
        paintRects(pageEl, [...range.getClientRects()], ordinal === activeOrdinal)
      } catch {}
    }
    ordinal++
    i += Math.max(1, q.length)
  }
}

`
a=a.slice(0,start)+block+a.slice(end)

// sheet 只保留第一个高亮为 current
a=a.replace("  paintRects(sheet, [...range.getClientRects()])", "  paintRects(sheet, [...range.getClientRects()], true)")
fs.writeFileSync('public/app.js',a)
console.log('search all occurrences ok')
