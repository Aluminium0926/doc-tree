import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "    if (index.length) parts.push(`【《${d.title}》页面索引】\\n${index.join('\\n')}`)",
  `    if (index.length) parts.push(\`【《\${d.title}》页面索引】\\n\${index.join('\\n')}\`)

    // 其余页给出开头一段，尽量覆盖“任意部分”
    const picked = new Set(pick.map((p) => p.no))
    const heads = []
    let headBudget = 12000
    for (const p of pages) {
      if (picked.has(p.no)) continue
      const txt = (p.text || '').trim()
      if (!txt) continue
      const take = txt.slice(0, 260)
      if (headBudget - take.length < 0) break
      headBudget -= take.length
      heads.push(\`[第\${p.no}页] \${take}\`)
    }
    if (heads.length) parts.push(\`【《\${d.title}》各页开头】\\n\${heads.join('\\n\\n')}\`)`
)
fs.writeFileSync(F, t)
console.log('page heads added')
