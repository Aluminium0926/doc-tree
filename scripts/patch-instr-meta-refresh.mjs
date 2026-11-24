import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `    toast(j.count === 0 ? '已清除所有指令' : j.reply ? \`指令已生效：\${j.reply}\` : '指令已生效')
    await loadState()`,
  `    toast(j.count === 0 ? '已清除所有指令' : j.reply ? \`指令已生效：\${j.reply}\` : '指令已生效')
    // 当前打开文档的指令数要立刻反映到标题下面，不用重新打开
    if (S.doc) {
      S.doc.instructions = j.count === 0 ? [] : [...(S.doc.instructions || []), text]
      const base = $('#doc-meta').textContent.replace(/ · 指令 \\d+$/, '')
      $('#doc-meta').textContent = base + (S.doc.instructions.length ? \` · 指令 \${S.doc.instructions.length}\` : '')
    }
    await loadState()`
)
fs.writeFileSync(F, t)
console.log(t.includes('不用重新打开') ? 'meta refresh ok' : 'not matched')
