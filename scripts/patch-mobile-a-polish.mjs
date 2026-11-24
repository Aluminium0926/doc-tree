import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("setStatus(`正在用 LibreOffice 转换：${f.name}`)", "setStatus(`正在渲染 PPT：${f.name}`)")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'))
const move=['@aiden0z/pptx-renderer','modern-screenshot','pdf-lib','@matbee/libreoffice-converter']
p.devDependencies ||= {}
for(const k of move){ if(p.dependencies?.[k]){ p.devDependencies[k]=p.dependencies[k]; delete p.dependencies[k] } }
fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
console.log('status + dep move ok', Object.keys(p.dependencies))
