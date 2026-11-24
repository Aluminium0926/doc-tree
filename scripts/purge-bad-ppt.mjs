const base='http://127.0.0.1:43171'
let s=await (await fetch(base+'/api/state')).json()
const bad=s.docs.find(d=>d.kind==='text' && /Cancer_Detection/.test(d.title))
if(bad){const r=await fetch(base+'/api/doc/purge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:bad.id})});console.log('purge',r.status,await r.text())}
