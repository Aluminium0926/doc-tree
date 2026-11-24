import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace("  x = x.replace(/\\s{2,}/g, ' ').replace(/\\s*[,;，；]\\s*(?=[,;，；]|$)/g, '').trim()", "  x = x.replace(/\\s*->\\s*[^,;，；]+/g, '')\n  x = x.replace(/\\s{2,}/g, ' ').replace(/\\s+([,;，；])/g, '$1').replace(/\\s*[,;，；]\\s*(?=[,;，；]|$)/g, '').trim()")
fs.writeFileSync('public/chem.js',j)
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.40", "chem.js?v=1.0.41").replace("const UI_VERSION = 'v146'","const UI_VERSION = 'v147'").replace("const APP_VERSION = '1.0.40'","const APP_VERSION = '1.0.41'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.41';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('condition cleanup + 1.0.41')
