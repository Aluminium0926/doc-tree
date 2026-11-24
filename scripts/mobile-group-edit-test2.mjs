import puppeteer from 'puppeteer-core'

const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true } })
const p = await b.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto('http://127.0.0.1:4501/', { waitUntil: 'networkidle2' })
await p.evaluate(() => {
  localStorage.setItem('dt:seenWelcome', '1')
  localStorage.removeItem('dt:groups')
})
await p.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 700))

for (const f of ['u1.md', 'u2.md', 'u3.md']) {
  const input = await p.$('#file-input')
  await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/' + f)
  await new Promise((r) => setTimeout(r, 1500))
}

const out = await p.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const ids = st.docs.filter((d) => !d.hidden).slice(0, 3).map((d) => d.id)
  if (ids.length < 3) return { error: '文档不足', count: ids.length }
  const g = await (await fetch('/api/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '手机编辑组', docIds: ids.slice(0, 2) }) })).json()
  const add = await (await fetch('/api/group/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.group.id, add: [ids[2]] }) })).json()
  const st2 = await (await fetch('/api/state')).json()
  const afterAdd = st2.groups.find((x) => x.id === g.group.id)?.docIds.length
  const rm = await (await fetch('/api/group/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.group.id, remove: [ids[2]] }) })).json()
  const st3 = await (await fetch('/api/state')).json()
  const afterRemove = st3.groups.find((x) => x.id === g.group.id)?.docIds.length
  const rm2 = await (await fetch('/api/group/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.group.id, remove: [ids[1]] }) })).json()
  const st4 = await (await fetch('/api/state')).json()
  return { afterAdd, afterRemove, addOk: add.group?.docIds.length, dissolved: rm2.dissolved, groupsLeft: st4.groups.length }
})
console.log(JSON.stringify({ out, errs }))
await b.close()
