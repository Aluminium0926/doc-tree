import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('.meta-instr')) {
  t += `

/* 文档 meta 里的指令数 */
.meta-instr {
  color: var(--accent-2);
  font-weight: 600;
}
`
  fs.writeFileSync(F, t)
}
console.log('meta chip css ok')
