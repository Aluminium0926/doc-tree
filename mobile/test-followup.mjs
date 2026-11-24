import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4500/', { waitUntil: 'domcontentloaded' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.evaluate(() => indexedDB.deleteDatabase('doctree'))
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 400))

const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/sample.md')
await new Promise((r) => setTimeout(r, 2000))

const askOnce = (parentId) =>
  page.evaluate(async (pid) => {
    const st = await (await fetch('/api/state')).json()
    const id = st.docs[0].id
    const body = {
      docId: id,
      question: pid ? '用一句话总结' : '这份文档讲了什么？',
      anchor: { kind: 'doc', page: 1, quote: '这是 Markdown 文档的正文' }
    }
    if (pid) {
      body.parentId = pid
      body.anchor = { kind: 'answer', nodeId: pid, quote: '文档' }
    }
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const text = await res.text()
    const events = text.split('\n\n').filter((l) => l.startsWith('data:')).map((l) => { try { return JSON.parse(l.slice(5).trim()) } catch { return null } }).filter(Boolean)
    const done = events.find((e) => e.type === 'done')
    const err = events.find((e) => e.type === 'error')
    return { id: done?.node?.id || null, len: done?.node?.answer?.length || 0, error: err?.message || null }
  }, parentId)

const root = await askOnce(null)
console.log('root', JSON.stringify(root))
const child = await askOnce(root.id)
console.log('child', JSON.stringify(child))

const tree = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const d = await (await fetch('/api/doc/' + st.docs[0].id)).json()
  const nodes = Object.values(d.tree.nodes)
  return { count: nodes.length, links: nodes.map((n) => ({ id: n.id.slice(0, 6), parent: n.parentId ? n.parentId.slice(0, 6) : null })) }
})
console.log('tree', JSON.stringify(tree))
// 界面上父节点应出现子分支
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1200))
console.log('dom nodes', await page.evaluate(() => document.querySelectorAll('.node').length))
await browser.close()
