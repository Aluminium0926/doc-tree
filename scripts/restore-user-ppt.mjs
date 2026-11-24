import fs from 'node:fs'
const buf=fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
const t0=Date.now()
const r=await fetch('http://127.0.0.1:43171/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')},body:buf})
const j=await r.json()
console.log(JSON.stringify({status:r.status,ms:Date.now()-t0,doc:j.doc,error:j.error},null,2))
