import fs from 'node:fs'
let s = fs.readFileSync('server.mjs', 'utf8')
s = s.split("  req.on('close', () => ac.abort())").join("  req.on('close', () => ac.abort())\n  res.on('close', () => ac.abort())")
fs.writeFileSync('server.mjs', s)
console.log('res close handler added')
