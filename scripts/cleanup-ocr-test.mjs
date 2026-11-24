const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json()
for(const d of st.docs.filter(x=>x.title==='OCR测试')){const r=await fetch(base+'/api/doc/purge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:d.id})});console.log('purge',d.id,r.status)}
console.log('docs', (await (await fetch(base+'/api/state')).json()).docs.length)
