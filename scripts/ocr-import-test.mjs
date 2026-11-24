import fs from 'node:fs'
const base='http://127.0.0.1:4317'
const buf=fs.readFileSync('scripts/lab-A-page1.png')
const r=await fetch(base+'/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('OCR测试.png')},body:buf})
const j=await r.json();console.log('import',r.status,JSON.stringify(j))
const d=await (await fetch(base+'/api/doc/'+j.doc.id)).json();console.log('text',JSON.stringify((d.doc.pages[0].text||'').slice(0,200)),'len',(d.doc.pages[0].text||'').length,'ocr',d.doc.ocr)
