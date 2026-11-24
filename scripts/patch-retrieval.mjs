import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')
const start = t.indexOf('  const parts = []')
const end = t.indexOf('  const ask = [')
if (start < 0 || end < 0) throw new Error('markers')

const block = `  // 用户问题里提到的页码：从所有文档里把这些页抓出来
  const refs = new Set()
  const qText = \`\${quote}\\n\${node.question || ''}\`
  for (const m of qText.matchAll(/(?:第\\s*|page\\s*|p\\.?\\s*)(\\d{1,4})\\s*页?/gi)) {
    const n = Number(m[1])
    if (n > 0) refs.add(n)
  }

  const pageLen = (d) => (d.pages || []).reduce((n, p) => n + (p.text || '').length, 0)
  const totalLen = all.reduce((n, d) => n + pageLen(d), 0)
  const FULL_BUDGET = 28000
  const full = totalLen > 0 && totalLen <= FULL_BUDGET

  const parts = []
  if (multi) {
    parts.push(
      \`【文档组（共 \${all.length} 份，共享提问树）】\\n\` +
        all.map((d) => \`《\${d.title}》\${full ? '：全文已附在下面' : ''}\`).join('\\n')
    )
  }

  for (const d of all) {
    const pages = d.pages || []
    if (!pages.length) continue

    if (full) {
      const body = pages
        .filter((p) => (p.text || '').trim())
        .map((p) => \`[第\${p.no}页]\\n\${p.text.slice(0, 5000)}\`)
        .join('\\n\\n')
      if (body.trim()) parts.push(\`【《\${d.title}》全文】\\n\${body}\`)
      continue
    }

    // 超长文档：锚点页、用户点名的页、页面索引
    const pick = pages.filter(
      (p) => refs.has(p.no) || (d.id === anchorDoc.id && Math.abs(p.no - pageNo) <= 1)
    )
    if (pick.length) {
      const body = pick
        .map((p) => \`[第\${p.no}页]\\n\${p.text.slice(0, 5000)}\`)
        .join('\\n\\n')
      parts.push(\`【《\${d.title}》相关页】\\n\${body}\`)
    }

    const index = pages
      .map((p) => {
        const head = (p.text || '').replace(/\\s+/g, ' ').slice(0, 46)
        return head ? \`- 第\${p.no}页：\${head}\` : ''
      })
      .filter(Boolean)
      .slice(0, 90)
    if (index.length) parts.push(\`【《\${d.title}》页面索引】\\n\${index.join('\\n')}\`)

    if (!multi && d.summary && !pick.length) {
      parts.push(\`【文档摘要】\\n\${d.summary}\`)
    }
  }

  if (multi) {
    const sums = all
      .filter((d) => d.summary)
      .map((d) => \`《\${d.title}》：\${trim(d.summary, 500)}\`)
      .join('\\n')
    if (sums) parts.push(\`【组内文档摘要】\\n\${sums}\`)
  }

  if (!full) {
    if (nearby) {
      const who = multi ? \`《\${anchorDoc.title}》\` : ''
      parts.push(\`【\${who}第 \${pageNo} 页\${quote ? '，选中处上下文' : '，本页内容'}】\\n\${nearby}\`)
    }
    if (related.length) {
      parts.push(
        \`【其他相关段落】\\n\` +
          related.map((c) => \`- \${multi ? \`《\${c.title}》\` : ''}第\${c.page}页 \${c.text}\`).join('\\n')
      )
    }
  }
  if (chainText) parts.push(\`【本次追问所在的分支】\\n\${chainText}\`)

`
t = t.slice(0, start) + block + t.slice(end)

t = t.replace(
  '- **不要生成应试辅助内容**',
  '- 下面已经提供了文档全文或相关页/页面索引；只要其中有对应内容，就直接依据它回答，**不要声称没有拿到某页文字**。\n- 若确实没有该页，再说明缺哪一页，并请用户贴出原文。\n- **不要生成应试辅助内容**'
)
fs.writeFileSync(F, t)
console.log('retrieval rebuilt')
