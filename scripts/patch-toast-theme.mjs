import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `  background: color-mix(in srgb, var(--panel-2) 96%, transparent);
  border: 1px solid var(--line-2);
  color: var(--text);
  box-shadow: var(--shadow);`,
  `  background: color-mix(in srgb, var(--accent) 14%, var(--panel-2));
  border: 1px solid color-mix(in srgb, var(--accent) 46%, transparent);
  color: var(--text);
  box-shadow: var(--shadow);`
)
t = t.replace(
  `#toast::before {
  content: '';
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-2);
  flex: 0 0 auto;
}`,
  `#toast::before {
  content: '';
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  flex: 0 0 auto;
}`
)
fs.writeFileSync(F, t)
console.log('toast themed')
