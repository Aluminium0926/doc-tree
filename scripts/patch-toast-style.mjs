import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `  background: rgba(58, 26, 30, 0.95);
  border: 1px solid var(--err-line);
  color: var(--err);`,
  `  background: color-mix(in srgb, var(--panel-2) 96%, transparent);
  border: 1px solid var(--line-2);
  color: var(--text);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 8px;`
)
if (!t.includes('#toast::before')) {
  t += `

/* 操作提示：默认中性，红底只留给明确的错误 */
#toast::before {
  content: '';
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-2);
  flex: 0 0 auto;
}
#toast.err {
  background: color-mix(in srgb, var(--err) 12%, var(--panel-2));
  border-color: var(--err-line);
  color: var(--err);
}
#toast.err::before { background: var(--err); }
`
}
fs.writeFileSync(F, t)
console.log('toast neutralized')
