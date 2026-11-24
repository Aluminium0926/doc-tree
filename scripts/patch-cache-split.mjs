import fs from 'node:fs'
const F = 'lib/context.mjs'
let t = fs.readFileSync(F, 'utf8')

// 把 user 内容拆成稳定段 / 易变段，并挂到消息上（不可枚举，不影响 OpenAI JSON）
const s = t.indexOf('  // ---------- user：稳定内容在前，易变内容在后 ----------')
const e = t.indexOf('  const content = []')
if (s < 0 || e < 0) throw new Error('markers')

const block = `  // ---------- user：稳定段（可缓存） / 易变段 ----------
  const stable = []
  const volatile = []

  if (multi) {
    stable.push(
      \`【文档组（共 \${all.length} 份，共享提问树）】\\n\` +
        all.map((d) => \`《\${d.title}》（\${(d.pages || []).length} 页）\`).join('\\n')
    )
    const sums = all
      .filter((d) => d.summary)
      .map((d) => \`《\${d.title}》：\${trim(d.summary, 500)}\`)
      .join('\\n')
    if (sums) stable.push(\`【组内文档摘要】\\n\${sums}\`)
    else stable.push(\`【文档开头】\\n\${trim(all[0].pages?.[0]?.text || '', 1200)}\`)
  } else {
    stable.push(\`【文档】\\n《\${anchorDoc.title}》（\${(anchorDoc.pages || []).length} 页）\`)
    stable.push(
      anchorDoc.summary
        ? \`【文档摘要】\\n\${anchorDoc.summary}\`
        : \`【文档开头】\\n\${trim(anchorDoc.pages?.[0]?.text || pageText, 1200)}\`
    )
  }

  const instr = all.flatMap((d) => d.instructions || []).filter(Boolean).slice(-10)
  if (instr.length) {
    stable.push(\`【用户附加指令（优先遵守）】\\n\${instr.map((x, i) => \`\${i + 1}. \${x}\`).join('\\n')}\`)
  }

  volatile.push(\`【本轮要求】\\n\${modeRules}\${groupRule}\`)

  if (followAnswer) {
    volatile.push('【本次是在追问上一条回答】')
  } else if (free) {
    volatile.push(\`【用户没有选中文字；当前停留在第 \${pageNo} 页（只是位置提示，不能假定问题只关于这一页）】\`)
  } else if (nearby) {
    const who = multi ? \`《\${anchorDoc.title}》\` : ''
    volatile.push(\`【\${who}第 \${pageNo} 页\${quote ? '，选中处上下文' : '，本页内容'}】\\n\${nearby}\`)
  }

  if (related.length) {
    volatile.push(
      \`【其他相关段落】\\n\` +
        related.map((c) => \`- \${multi ? \`《\${c.title}》\` : ''}第\${c.page}页 \${trim(c.text, 700)}\`).join('\\n')
    )
  }
  if (chainText) volatile.push(\`【本次追问所在的分支】\\n\${chainText}\`)

  const askLines = []
  if (quote) {
    askLines.push(\`我在\${multi ? \`《\${anchorDoc.title}》\` : ''}（第 \${pageNo} 页）选中了：「\${quote}」\`)
  } else if (followAnswer) {
    askLines.push('（继续追问上一条回答）')
  } else if (!free) {
    askLines.push(\`请讲解\${multi ? \`《\${anchorDoc.title}》\` : ''}第 \${pageNo} 页的整页内容。\`)
  }
  volatile.push([...askLines, \`我的问题：\${node.question || '请讲解这段内容'}\`].join('\\n'))

`
t = t.slice(0, s) + block + t.slice(e)

// 组装 user 文本 + 挂稳定段
t = t.replace(
  `  const content = []
  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
  content.push({ type: 'text', text: parts.join('\\n\\n') + '\\n\\n' + ask })

  return [
    { role: 'system', content: system },
    { role: 'user', content: content.length === 1 ? content[0].text : content }
  ]`,
  `  const stableText = stable.join('\\n\\n')
  const volatileText = volatile.join('\\n\\n')
  const content = []
  if (image) content.push({ type: 'image_url', image_url: { url: image, detail: 'high' } })
  content.push({ type: 'text', text: stableText + '\\n\\n' + volatileText })

  const userMsg = { role: 'user', content: content.length === 1 ? content[0].text : content }
  // Anthropic 缓存用：稳定段单独标记，不可枚举，不会进入 OpenAI 请求体
  Object.defineProperty(userMsg, '_stableText', { value: stableText, enumerable: false })
  Object.defineProperty(userMsg, '_volatileText', { value: volatileText, enumerable: false })

  return [{ role: 'system', content: system }, userMsg]`
)
fs.writeFileSync(F, t)
console.log('stable/volatile split ok')
