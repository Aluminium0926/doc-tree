import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 700))
const ids = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const vis = st.docs.filter(d => !d.hidden && !d.groupId).slice(0, 2)
  return vis.map(d => d.id)
})
await p.click('#btn-group')
await new Promise(r => setTimeout(r, 300))
for (const id of ids) {
  await p.evaluate((id) => document.querySelector(`.doc-item[data-id="${id}"]`)?.click(), id)
  await new Promise(r => setTimeout(r, 200))
}
const bar = await p.evaluate(() => ({ count: document.querySelector('#group-bar-count').textContent, disabled: document.querySelector('#group-create').disabled }))
await p.evaluate(() => { document.querySelector('#group-name').value = '测试组' })
await p.click('#group-create')
await new Promise(r => setTimeout(r, 1300))
const after = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const g = st.groups[0]
  return { groups: st.groups.length, gid: g?.id, name: g?.name, members: g?.docIds?.length, rows: [...document.querySelectorAll('.doc-group .g-name')].map(x => x.textContent) }
})
if (after.gid) {
  const shared = await p.evaluate(async (gid) => {
    const st = await (await fetch('/api/state')).json()
    const g = st.groups.find(x => x.id === gid)
    const a = await (await fetch('/api/doc/' + g.docIds[0])).json()
    const b2 = await (await fetch('/api/doc/' + g.docIds[1])).json()
    return { a: Object.keys(a.tree.nodes).length, b: Object.keys(b2.tree.nodes).length }
  }, after.gid)
  await p.evaluate(async (gid) => {
    const st = await (await fetch('/api/state')).json()
    const g = st.groups.find(x => x.id === gid)
    document.querySelector(`.doc-item[data-id="${g.docIds[0]}"]`)?.click()
  }, after.gid)
  await new Promise(r => setTimeout(r, 1500))
  const tag = await p.evaluate(() => ({ hidden: document.querySelector('#tree-group').hidden, text: document.querySelector('#tree-group').textContent }))
  console.log(JSON.stringify({ bar, after, shared, tag, errs }))
} else {
  console.log(JSON.stringify({ bar, after, errs }))
}
await p.screenshot({ path: 'group-ui.png' })
await b.close()
