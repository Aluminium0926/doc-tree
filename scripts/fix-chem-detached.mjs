import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replaceAll("  if (!fig.isConnected) return\n", "")
j=j.replaceAll("    if (!fig.isConnected) return\n", "")
j=j.replaceAll("    if (!fig.isConnected) return\n", "")
fs.writeFileSync('public/chem.js',j)
console.log('remaining connected guards', (j.match(/fig\.isConnected/g)||[]).length)
