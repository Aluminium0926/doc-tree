import fs from 'node:fs'
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace(
  `  $('#doc-meta').textContent =
    S.doc.kind === 'pdf'
      ? \`\${S.doc.pages.length} 页 · PDF\`
      : \`\${(S.doc.kind || '').toUpperCase()} · \${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字\``,
  `  const metaBase =
    S.doc.kind === 'pdf'
      ? \`\${S.doc.pages.length} 页 · PDF\`
      : \`\${(S.doc.kind || '').toUpperCase()} · \${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字\`
  $('#doc-meta').textContent = metaBase + ((S.doc.instructions || []).length ? \` · 指令 \${S.doc.instructions.length}\` : '')`
)
a = a.replace(
  "    toast(j.reply ? `指令已生效：${j.reply}` : '指令已生效')",
  "    toast(j.count === 0 ? '已清除所有指令' : j.reply ? `指令已生效：${j.reply}` : '指令已生效')"
)
fs.writeFileSync('public/app.js', a)

let h = fs.readFileSync('public/index.html', 'utf8')
h = h.replace('title="指令模式：输入什么就发什么，用来改回答方式（不计入提问树）"', 'title="指令模式：输入什么就发什么，用来改回答方式（不计入提问树）；发送「清除指令」可清空"')
fs.writeFileSync('public/index.html', h)
console.log('meta + toast fixed')
