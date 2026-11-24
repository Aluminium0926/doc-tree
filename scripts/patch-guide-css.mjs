import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('#welcome-guide .modal-actions')) {
  t += `

#welcome-guide .modal-actions { flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
#welcome-guide .modal-actions button { white-space: nowrap; }
#welcome-guide .modal-actions .ghost { padding: 6px 12px; }
`
  fs.writeFileSync(F, t)
}
console.log('guide css ok')
