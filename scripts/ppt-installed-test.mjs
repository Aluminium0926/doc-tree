import fs from 'node:fs'
const buf=fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
const t0=Date.now()
const r=await fetch('http://127.0.0.1:43171/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('PPT转换测试.pptx')},body:buf})
const j=await r.json()
console.log(JSON.stringify({status:r.status,ms:Date.now()-t0,doc:j.doc,error:j.error},null,2))
if(j.doc){const d=await (await fetch('http://127.0.0.1:43171/api/doc/'+j.doc.id)).json();console.log('kind',d.doc.kind,'ext',d.doc.ext,'pages',d.doc.pages.length,'text0',(d.doc.pages[0]?.text||'').slice(0,120))}
