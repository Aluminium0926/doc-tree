import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('@media (hover: none)')) {
  t += `

/* 触屏没有 hover：移出按钮常显 */
@media (hover: none) {
  .doc-item .ungroup { opacity: 1; }
}`
  fs.writeFileSync(F, t)
}
console.log('touch css ok')
