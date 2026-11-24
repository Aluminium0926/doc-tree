import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true } })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
await p.evaluate(() => { localStorage.setItem('dt:seenWelcome','1'); localStorage.removeItem('dt:groups') })
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 800))
const out = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  let ids = st.docs.filter(d => !d.hidden).map(d => d.id)
  while (ids.length < 2) {
    const res = await fetch('/api/import', { method: 'POST', headers: { 'x-filename': 'ren' + Date.now() + '.md' }, body: new Blob(['# rename ' + Math.random()]) })
    const j = await res.json(); ids.push(j.doc.id)
  }
  const g = await (await fetch('/api/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '旧名', docIds: ids.slice(0,2) }) })).json()
  await fetch('/api/group/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.group.id, name: '手机新名' }) })
  const st2 = await (await fetch('/api/state')).json()
  return st2.groups.find(x => x.id === g.group.id)?.name
})
console.log(JSON.stringify({ name: out }))
await b.close()
