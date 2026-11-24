const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
const d=await (await fetch(base+'/api/doc/'+doc.id)).json()
const nodes=Object.values(d.tree.nodes).sort((a,b)=>a.createdAt-b.createdAt)
const n=nodes[nodes.length-1]
console.log('node', n?.question, 'stopped', n?.stopped, 'len', n?.answer?.length)
const r=await fetch(base+'/api/ask/resume',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,nodeId:n.id})})
const text=await r.text()
console.log('status', r.status, text.slice(0,500))
