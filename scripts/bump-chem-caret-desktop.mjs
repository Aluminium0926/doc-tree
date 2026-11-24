import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.36", "chem.js?v=1.0.37").replace("const UI_VERSION = 'v142'","const UI_VERSION = 'v143'").replace("const APP_VERSION = '1.0.36'","const APP_VERSION = '1.0.37'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.37';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('desktop-only bump 1.0.37/v143 / chem 1.0.37')
