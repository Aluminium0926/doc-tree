import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.39", "chem.js?v=1.0.40").replace("const UI_VERSION = 'v145'","const UI_VERSION = 'v146'").replace("const APP_VERSION = '1.0.39'","const APP_VERSION = '1.0.40'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.40';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('desktop 1.0.40/v146 chem 1.0.40')
