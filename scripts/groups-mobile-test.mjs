import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
await p.evaluate(() => { localStorage.setItem('dt:seenWelcome','1'); localStorage.removeItem('dt:groups') })
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
for (const f of ['g1.md','g2.md']) {
  const input = await p.$('#file-input')
  await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/' + f)
  await new Promise(r => setTimeout(r, 1600))
}
const created = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const ids = st.docs.filter(d => !d.hidden).slice(0, 2).map(d => d.id)
  const r = await (await fetch('/api/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '移动组', docIds: ids }) })).json()
  return { ids, group: r.group }
})
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 1200))
const out = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const g = st.groups[0]
  const a = await (await fetch('/api/doc/' + g.docIds[0])).json()
  return { groups: st.groups.length, name: g?.name, members: g?.docIds.length, rows: [...document.querySelectorAll('.doc-group .g-name')].map(x => x.textContent), inGroup: document.querySelectorAll('.doc-item.in-group').length, treeNodes: Object.keys(a.tree.nodes).length }
})
console.log(JSON.stringify({ created: { n: created.ids.length }, out, errs }))
await p.screenshot({ path: 'group-mobile.png' })
await b.close()
