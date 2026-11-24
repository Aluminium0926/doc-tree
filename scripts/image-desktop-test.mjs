import fs from 'node:fs'
const base='http://127.0.0.1:4317'
const buf=fs.readFileSync('scripts/lab-A-page1.png')
const r=await fetch(base+'/api/import',{method:'POST',headers:{'x-filename':encodeURIComponent('测试图片.png')},body:buf})
const j=await r.json();console.log('import',r.status,JSON.stringify(j))
const d=await (await fetch(base+'/api/doc/'+j.doc.id)).json();console.log('kind',d.doc.kind,'pages',d.doc.pages.length,'wh',d.doc.pages[0].w,d.doc.pages[0].h,'ext',d.doc.ext)
const f=await fetch(base+'/api/file/'+j.doc.id);console.log('file',f.status,f.headers.get('content-type'),(await f.arrayBuffer()).byteLength)
const askr=await fetch(base+'/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:j.doc.id,anchor:{kind:'doc',page:1,quote:''},question:'这张图里有什么？用一句话描述'})})
const reader=askr.body.getReader();const dec=new TextDecoder();let b='',ans=''
while(true){const {value,done}=await reader.read();if(done)break;b+=dec.decode(value,{stream:true});let i;while((i=b.indexOf('\n\n'))>=0){const raw=b.slice(0,i);b=b.slice(i+2);if(!raw.startsWith('data: '))continue;let e;try{e=JSON.parse(raw.slice(6))}catch{continue};if(e.type==='delta')ans+=e.text;if(e.type==='error')ans+='[ERR]'+e.message}}
console.log('answer',ans.slice(-300))
