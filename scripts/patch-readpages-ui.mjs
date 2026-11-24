import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "        ev.name === 'read_page'\n          ? `正在读第 ${args.page} 页…`",
  "        ev.name === 'read_page'\n          ? `正在读第 ${args.page} 页…`\n          : ev.name === 'read_pages'\n            ? `正在读第 ${args.from}–${args.to} 页…`"
)
fs.writeFileSync(F, t)
console.log('read_pages label ok')
