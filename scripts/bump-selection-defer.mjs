import fs from 'node:fs'
let ctx=fs.readFileSync('lib/context.mjs','utf8')
ctx=ctx.replace("SMILES 必须能被 RDKit 解析，不确定时宁可只给名称和文字。", "SMILES 必须能被 RDKit 解析；不确定时宁可只给名称和普通文字，不要输出只有 label 没有结构的空 smiles/reaction 块。")
fs.writeFileSync('lib/context.mjs',ctx)
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.44", "chem.js?v=1.0.45").replace("const UI_VERSION = 'v150'","const UI_VERSION = 'v151'").replace("const APP_VERSION = '1.0.44'","const APP_VERSION = '1.0.45'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.45';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('desktop 1.0.45/v151')
