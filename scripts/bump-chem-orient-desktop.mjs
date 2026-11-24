import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.37", "chem.js?v=1.0.38").replace("const UI_VERSION = 'v143'","const UI_VERSION = 'v144'").replace("const APP_VERSION = '1.0.37'","const APP_VERSION = '1.0.38'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.38';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('desktop 1.0.38/v144 chem query 1.0.38')
