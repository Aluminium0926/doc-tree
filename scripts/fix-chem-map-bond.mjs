import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace("    Promise.all(r.left.map(moleculeSvg)),\n    Promise.all(r.right.map(moleculeSvg))", "    Promise.all(r.left.map((s) => moleculeSvg(s, 22))),\n    Promise.all(r.right.map((s) => moleculeSvg(s, 22)))")
fs.writeFileSync('public/chem.js',j)
console.log('map bond fixed', j.includes('moleculeSvg(s, 22)'))
