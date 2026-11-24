import fs from 'node:fs'
const F = 'scripts/usage-test.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const ui = await p.evaluate(()=>document.querySelector('.node-usage')?.textContent || '')",
  "  const ui = await p.evaluate(()=>{ const all=[...document.querySelectorAll('.node-usage')]; return all.length ? all[all.length-1].textContent : '' })"
)
fs.writeFileSync(F, t)
console.log('test query fixed')
