import puppeteer from 'puppeteer-core'

const base = 'http://127.0.0.1:4317'
const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => ({ ok: r.ok, ...(await r.json()) }))
const state = () => fetch(base + '/api/state').then((r) => r.json())

const st = await state()
const docs = st.docs.filter((d) => !d.hidden && !d.groupId).slice(0, 4)
if (docs.length < 4) throw new Error('测试文档不足')
const [a, b, c, d] = docs.map((x) => x.id)

// API：建组 → 加入 → 移出 → 自动解散
const g1 = await post('/api/group', { name: '编辑测试', docIds: [a, b] })
const add = await post('/api/group/update', { id: g1.group.id, add: [c] })
const st2 = await state()
const afterAdd = st2.groups.find((x) => x.id === g1.group.id)?.docIds.length
const rm1 = await post('/api/group/update', { id: g1.group.id, remove: [c] })
const st3 = await state()
const afterRemove = st3.groups.find((x) => x.id === g1.group.id)?.docIds.length
const removedTree = await fetch(base + '/api/doc/' + c).then((r) => r.json())
const rm2 = await post('/api/group/update', { id: g1.group.id, remove: [b] })
const st4 = await state()
const afterDissolve = st4.groups.length

// UI：再建一组，验证 ＋ / 移出 / 已移除折叠
const g2 = await post('/api/group', { name: 'UI测试', docIds: [a, b] })
await fetch(base + '/api/doc/' + d, { method: 'DELETE' })

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await browser.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
await p.goto(base + '/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome', '1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 900))

const ui0 = await p.evaluate(() => ({
  gAdd: !!document.querySelector('.doc-group .g-add'),
  ungroup: document.querySelectorAll('.doc-item.in-group .ungroup').length,
  groupName: document.querySelector('.doc-group .g-name')?.textContent
}))
// 点 ＋ 移入
await p.click('.doc-group .g-add')
await new Promise((r) => setTimeout(r, 300))
const sel = await p.evaluate(() => ({ head: document.querySelector('.lib-sel-head')?.textContent, create: document.querySelector('#group-create')?.textContent, nameHidden: document.querySelector('#group-name')?.hidden }))
const candidate = await p.evaluate(() => [...document.querySelectorAll('.doc-item')].find((el) => !el.classList.contains('in-group'))?.dataset.id)
await p.evaluate((id) => document.querySelector(`.doc-item[data-id="${id}"]`)?.click(), candidate)
await new Promise((r) => setTimeout(r, 200))
await p.click('#group-create')
await new Promise((r) => setTimeout(r, 1000))
const st5 = await state()
const uiAddCount = st5.groups.find((x) => x.id === g2.group.id)?.docIds.length

// 移出一份
await p.evaluate(() => document.querySelector('.doc-item.in-group .ungroup')?.click())
await new Promise((r) => setTimeout(r, 1000))
const st6 = await state()
const uiRemoveCount = st6.groups.find((x) => x.id === g2.group.id)?.docIds.length

// 已移除折叠
const archBefore = await p.evaluate(() => ({ head: !!document.querySelector('.doc-arch-head'), rows: document.querySelectorAll('.doc-item.archived').length }))
await p.click('.doc-arch-head')
await new Promise((r) => setTimeout(r, 300))
const archAfter = await p.evaluate(() => ({ rows: document.querySelectorAll('.doc-item.archived').length, collapsed: localStorage.getItem('dt:archCollapsed') }))

console.log(JSON.stringify({
  api: { created: g1.ok, afterAdd, afterRemove, removedTreeNodes: Object.keys(removedTree.tree?.nodes || {}).length, dissolved: rm2.dissolved, groupsLeft: afterDissolve },
  ui: { ...ui0, sel, uiAddCount, uiRemoveCount, archBefore, archAfter, errs }
}, null, 1))
await browser.close()
