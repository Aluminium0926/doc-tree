import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
if (!t.includes('.g-add')) {
  t += `

/* ---------- 组编辑 ---------- */
.doc-group .g-add {
  border: 0; background: none; color: var(--dim-2);
  font-size: 13px; line-height: 1; padding: 2px 4px; border-radius: 5px;
}
.doc-group .g-add:hover { color: var(--accent-2); background: var(--panel-3); }
.doc-item .ungroup {
  border: 0; background: none; color: var(--dim-2);
  font-size: 10.5px; padding: 1px 5px; border-radius: 5px;
  opacity: 0; transition: opacity .12s;
}
.doc-item:hover .ungroup { opacity: 1; }
.doc-item .ungroup:hover { color: var(--accent-2); background: var(--panel-3); }
.lib-sel-head { padding: 10px 12px 6px; font-size: 11px; color: var(--dim); }
.doc-arch-head { cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
.doc-arch-head:hover { color: var(--text); }
.arch-chev { font-size: 10px; }
`
  fs.writeFileSync(F, t)
}
console.log('css ok')
