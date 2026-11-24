const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
const g = st.groups[0]
const r = await fetch('http://127.0.0.1:4317/api/group/dissolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.id }) })
console.log(r.status, await r.text())
const after = await (await fetch('http://127.0.0.1:4317/api/state')).json()
console.log('groups after:', after.groups.length)
