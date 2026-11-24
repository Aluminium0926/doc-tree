import puppeteer from 'puppeteer-core'
const base = 'http://127.0.0.1:4317'
const state = () => fetch(base + '/api/state').then(r => r.json())
const st = await state()
const g = st.groups[0]
if (!g) throw new Error('无组')
const cand = st.docs.find(d => !d.hidden && !d.groupId)?.id
if (!cand) throw new Error('无候选文档')
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message.slice(0, 160)))
await p.goto(base + '/', { waitUntil: 'networkidle2' })
await p.evaluate(() => localStorage.setItem('dt:seenWelcome', '1'))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
const before = (await state()).groups.find(x => x.id === g.id).docIds.length
await p.click('.doc-group .g-add')
await new Promise(r => setTimeout(r, 300))
await p.evaluate((id) => document.querySelector(`.doc-item[data-id="${id}"]`)?.click(), cand)
await new Promise(r => setTimeout(r, 200))
await p.click('#group-create')
await new Promise(r => setTimeout(r, 1200))
const afterAdd = (await state()).groups.find(x => x.id === g.id)?.docIds.length
const ungroupVisible = await p.evaluate((id) => {
  const el = document.querySelector(`.doc-item[data-id="${id}"] .ungroup`)
  if (!el) return 'missing'
  const cs = getComputedStyle(el)
  return { opacity: cs.opacity, text: el.textContent }
}, cand)
await p.evaluate((id) => document.querySelector(`.doc-item[data-id="${id}"] .ungroup`)?.click(), cand)
await new Promise(r => setTimeout(r, 1200))
const afterRemove = (await state()).groups.find(x => x.id === g.id)?.docIds.length
const collapsed0 = await p.evaluate(() => ({ rows: document.querySelectorAll('.doc-item.archived').length, flag: localStorage.getItem('dt:archCollapsed') }))
await p.click('.doc-arch-head')
await new Promise(r => setTimeout(r, 300))
await p.reload({ waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 900))
const collapsed1 = await p.evaluate(() => ({ rows: document.querySelectorAll('.doc-item.archived').length, flag: localStorage.getItem('dt:archCollapsed') }))
console.log(JSON.stringify({ before, afterAdd, ungroupVisible, afterRemove, collapsed0, collapsed1, errs }, null, 1))
await b.close()
