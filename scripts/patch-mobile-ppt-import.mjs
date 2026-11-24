import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
const block=fs.readFileSync('scripts/import-files-new.txt','utf8').trimEnd()+'\n'
const start=a.indexOf('async function importFiles(files) {')
const end=a.indexOf('/* ================= 打开文档',start)
if(start<0||end<0) throw new Error('markers')
a=a.slice(0,start)+block+'\n'+a.slice(end)
fs.writeFileSync('public/app.js',a)
console.log('importFiles replaced')
