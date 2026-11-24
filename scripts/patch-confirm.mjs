import fs from 'node:fs'
const FILE = 'public/app.js'
let t = fs.readFileSync(FILE, 'utf8')
const re = /if \(!confirm\(`把《\$\{d\.title\}》移出列表？[\s\S]*?\)\) return/
if (!re.test(t)) { console.log('未匹配'); process.exit(1) }
t = t.replace(re, 'if (!(await confirmRemove(d.title))) return')
fs.writeFileSync(FILE, t)
console.log('ok')
