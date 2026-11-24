import fs from 'node:fs'
const F = 'scripts/mobile-group-edit-test2.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("['g1.md', 'g2.md', 'math.md']", "['u1.md', 'u2.md', 'u3.md']")
fs.writeFileSync(F, t)
console.log('fixtures switched')
