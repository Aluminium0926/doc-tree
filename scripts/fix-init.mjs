import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
const m1 = t.match(/init\(\)\s*\r?\n\s*async function function maybeWelcome\(\) \{/)
if (!m1) { console.log('m1 not found'); process.exit(1) }
const start = m1.index
const m2 = t.slice(start).match(/init\(\) \{\s*\r?\n\s*bind\(\)/)
if (!m2) { console.log('m2 not found'); process.exit(1) }
const midEnd = start + m2.index + m2[0].length
const head = t.slice(0, start)
let tail = t.slice(midEnd)
tail = tail.replace(/\}\s*\r?\n\s*function setLeftCollapsed/, '}\n\ninit()\n\nfunction setLeftCollapsed')
t = head + 'maybeWelcome()\n\nasync function init() {\n  bind()\n  maybeWelcome()\n' + tail
fs.writeFileSync(F, t)
console.log('patched', start, midEnd)
