import fs from 'node:fs'
const F = 'scripts/resume-test.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("  const isResume = (j.messages||[]).some(m=>m.role==='assistant' && typeof m.content==='string' && m.content.includes('片段'))", "  const isResume = (j.messages||[]).some(m=>m.role==='assistant')")
t = t.replace("  await new Promise(r=>setTimeout(r,1200))\n  await p.click('#btn-stop')", "  await new Promise(r=>setTimeout(r,2200))\n  await p.click('#btn-stop')")
fs.writeFileSync(F, t)
console.log('resume test updated')
