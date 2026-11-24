const base='http://127.0.0.1:43171'
const s=await (await fetch(base+'/api/state')).json()
for(const d of s.docs.filter(x=>/PPT转换测试/.test(x.title))){await fetch(base+'/api/doc/purge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:d.id})});console.log('purged test',d.id)}
