import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "#welcome-guide .modal-actions { flex-wrap: wrap; gap: 8px; justify-content: flex-end; }\n#welcome-guide .modal-actions button { white-space: nowrap; }\n#welcome-guide .modal-actions .ghost { padding: 6px 12px; }",
  "#welcome-guide .modal-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\n#welcome-guide .modal-actions button { white-space: nowrap; }\n#welcome-guide .modal-actions .ghost { padding: 6px 12px; }\n#welcome-guide #welcome-guide-done { grid-column: 1 / -1; }"
)
fs.writeFileSync(F, t)
console.log('grid ok')
