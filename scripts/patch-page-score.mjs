import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')

// 页面相关性打分
const helper = `
function pageScore(text, qs) {
  const t = String(text || '').toLowerCase()
  let score = 0
  for (const q of qs) {
    let at = 0
    let hits = 0
    while ((at = t.indexOf(q, at)) !== -1 && hits < 4) {
      hits++
      at += q.length
    }
    if (hits) score += 1 + Math.log(hits)
  }
  return score / Math.sqrt(t.length + 200)
}
`
if (!t.includes('function pageScore')) t = t.replace('export function buildAskMessages', helper + '\nexport function buildAskMessages')

t = t.replace(
  "    // 超长文档：锚点页、用户点名的页、页面索引\n    const pick = pages.filter(\n      (p) => refs.has(p.no) || (d.id === anchorDoc.id && Math.abs(p.no - pageNo) <= 1)\n    )",
  `    // 超长文档：锚点页、用户点名的页、按问题相关性挑出的页
    const qs = tokens(\`\${quote}\\n\${node.question || ''}\`)
    const scored = pages
      .map((p) => ({ p, s: pageScore(p.text, qs) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.p)
    const pick = pages.filter(
      (p) =>
        refs.has(p.no) ||
        (d.id === anchorDoc.id && Math.abs(p.no - pageNo) <= 1) ||
        scored.includes(p)
    )`
)
fs.writeFileSync(F, t)
console.log('page scoring added')
