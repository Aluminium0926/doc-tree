const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json()
const test=st.docs.filter(d=>d.title==='测试图片')
for(const d of test){ const r=await fetch(base+'/api/doc/purge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:d.id})});console.log('purge',d.id,r.status) }
const st2=await (await fetch(base+'/api/state')).json();console.log('docs now',st2.docs.length,st2.docs.slice(0,3).map(d=>d.title))
