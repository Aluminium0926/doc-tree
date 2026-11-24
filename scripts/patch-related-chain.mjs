import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')

t = t.replace(
  `  const related = rankChunks(chunks, \`\${quote}\\n\${node.question}\`, 4)
    .filter((c) => !(c.docId === anchorDoc.id && c.page === pageNo && nearby.includes(c.text.slice(0, 80))))
    .slice(0, 3)`,
  `  const ranked = rankChunks(chunks, \`\${quote}\\n\${node.question}\`, 6)
  const topScore = ranked[0]?.score || 0
  const related = ranked
    .filter((c) => topScore > 0 && c.score >= Math.max(0.02, topScore * 0.35))
    .filter((c) => !(c.docId === anchorDoc.id && c.page === pageNo && nearby.includes(c.text.slice(0, 40))))
    .slice(0, 2)`
)

t = t.replace(
  `  const chain = chainOf(tree, node.parentId)
  const chainText = chain
    .map((n, i) => {
      const q = trim(n.quote || n.anchor?.quote, 160)
      return \`\${i + 1}. 选中「\${q}」→ 问：\${trim(n.question, 160)}\\n   答：\${trim(n.answer, 500)}\`
    })
    .join('\\n')`,
  `  const chain = chainOf(tree, node.parentId).slice(-4)
  const chainText = chain
    .map((n, i) => {
      const q = trim(n.quote || n.anchor?.quote, 160)
      // 最后一条（直接父节点）给更长，方便追问证明；更早的只留要点
      const limit = i === chain.length - 1 ? 800 : 250
      return \`\${i + 1}. 选中「\${q}」→ 问：\${trim(n.question, 160)}\\n   答：\${trim(n.answer, limit)}\`
    })
    .join('\\n')`
)

t = t.replace(
  "related.map((c) => `- ${multi ? `《${c.title}》` : ''}第${c.page}页 ${trim(c.text, 700)}`).join('\\n')",
  "related.map((c) => `- ${multi ? `《${c.title}》` : ''}第${c.page}页 ${trim(c.text, 500)}`).join('\\n')"
)
fs.writeFileSync(F, t)
console.log('related/chain trimmed')
