import fs from 'node:fs'
const buf=fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_and_Classification_EN.pptx')
const t0=Date.now()
const r=await fetch('http://127.0.0.1:43171/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('mac兼容转换测试.pptx')},body:buf})
const j=await r.json()
console.log(JSON.stringify({status:r.status,ms:Date.now()-t0,doc:j.doc,error:j.error},null,2))
if(j.doc && j.doc.kind!=='pdf') process.exit(2)
if(j.doc){await fetch('http://127.0.0.1:43171/api/doc/purge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:j.doc.id})});console.log('purged test')}
