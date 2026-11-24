const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json()
for(const d of st.docs.slice(0,20)){
  const r=await (await fetch(base+'/api/doc/'+d.id)).json()
  const n=Object.keys(r.tree?.nodes||{}).length
  if(n) console.log(d.id,d.title,'nodes',n,'kind',d.kind)
}
