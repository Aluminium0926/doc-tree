import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 统一渲染 doc-meta，并把指令数做成高亮小标签
if (!t.includes('function renderDocMeta')) {
  t = t.replace(
    'function resetViewer() {',
    `function renderDocMeta() {
  const el = $('#doc-meta')
  if (!el) return
  if (!S.doc) {
    el.textContent = ''
    return
  }
  const base =
    S.doc.kind === 'pdf'
      ? \`\${S.doc.pages.length} 页 · PDF\`
      : \`\${(S.doc.kind || '').toUpperCase()} · \${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字\`
  const n = (S.doc.instructions || []).length
  el.innerHTML = esc(base) + (n ? \` · <span class="meta-instr">指令 \${n}</span>\` : '')
}

function resetViewer() {`
  )
}

t = t.replace(
  `  const metaBase =
    S.doc.kind === 'pdf'
      ? \`\${S.doc.pages.length} 页 · PDF\`
      : \`\${(S.doc.kind || '').toUpperCase()} · \${(S.doc.pages?.[0]?.text || '').length.toLocaleString()} 字\`
  $('#doc-meta').textContent = metaBase + ((S.doc.instructions || []).length ? \` · 指令 \${S.doc.instructions.length}\` : '')`,
  '  renderDocMeta()'
)

t = t.replace(
  `    if (S.doc) {
      S.doc.instructions = j.count === 0 ? [] : [...(S.doc.instructions || []), text]
      const base = $('#doc-meta').textContent.replace(/ · 指令 \\d+$/, '')
      $('#doc-meta').textContent = base + (S.doc.instructions.length ? \` · 指令 \${S.doc.instructions.length}\` : '')
    }`,
  `    if (S.doc) {
      S.doc.instructions = j.count === 0 ? [] : [...(S.doc.instructions || []), text]
      renderDocMeta()
    }`
)
fs.writeFileSync(F, t)
console.log('renderDocMeta wired')
