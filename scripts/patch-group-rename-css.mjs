import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('.g-rename')) {
  t += `

/* 组名重命名输入框 */
.g-rename {
  flex: 1; min-width: 0;
  font: inherit; font-size: 12px; font-weight: 600;
  color: var(--text); background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 6px; padding: 2px 6px; outline: none;
}
`
  fs.writeFileSync(F, t)
}
console.log('rename css ok')
