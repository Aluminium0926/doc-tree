import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.43", "chem.js?v=1.0.44").replace("const UI_VERSION = 'v149'","const UI_VERSION = 'v150'").replace("const APP_VERSION = '1.0.43'","const APP_VERSION = '1.0.44'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.44';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('desktop 1.0.44/v150')
