import fs from 'node:fs'
let s=fs.readFileSync('scripts/ppt-lab-server.mjs','utf8')
s=s.replace("    if (url === '/') url = '/ppt-lab/index.html'", "    if (url === '/') url = '/ppt-lab/index.html'\n    if (url.endsWith('/')) url += 'index.html'")
fs.writeFileSync('scripts/ppt-lab-server.mjs',s)
console.log('dir index ok')
