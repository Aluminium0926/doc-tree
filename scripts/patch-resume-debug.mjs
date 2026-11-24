import fs from 'node:fs'
const F = 'scripts/resume-test.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  await p.click('.node [data-act=\"resume\"]')\n  await new Promise(r=>setTimeout(r,1200))",
  "  await p.click('.node [data-act=\"resume\"]')\n  await new Promise(r=>setTimeout(r,700))\n  const toast = await p.evaluate(()=>document.querySelector('#toast')?.textContent || '')\n  const status2 = await p.evaluate(()=>document.querySelector('#status').textContent)\n  console.log('TOAST', toast, 'STATUS', status2)\n  await new Promise(r=>setTimeout(r,1200))"
)
fs.writeFileSync(F, t)
console.log('debug added')
