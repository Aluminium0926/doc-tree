import fs from 'node:fs'
const F = 'scripts/resume-test.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  await p.click('.node [data-act=\"resume\"]')",
  "  await p.evaluate(() => { const els=[...document.querySelectorAll('.node [data-act=\"resume\"]')]; els[els.length-1]?.click() })"
)
fs.writeFileSync(F, t)
console.log('click latest')
