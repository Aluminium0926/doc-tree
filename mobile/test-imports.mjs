import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4500'
const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))
const fix = 'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 150)))
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('CERR ' + m.text().slice(0, 150))
})

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))

async function importFile(name) {
  const input = await page.$('#file-input')
  await input.uploadFile(`${fix}/${name}`)
  await new Promise((r) => setTimeout(r, 2500))
  return page.evaluate(() => ({
    title: document.querySelector('#doc-title').textContent,
    meta: document.querySelector('#doc-meta').textContent,
    pages: document.querySelectorAll('.page').length,
    sheet: Boolean(document.querySelector('#sheet')),
    text: (document.querySelector('.sheet')?.textContent || '').slice(0, 40)
  }))
}

for (const f of ['sample.md', 'sample.txt', 'sample.docx']) {
  const r = await importFile(f)
  console.log(f, JSON.stringify(r))
}

// 追问：对同一份文档再问一次，指定 parentId
const follow = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const id = st.docs[0].id
  const d = await (await fetch('/api/doc/' + id)).json()
  const tree = d.tree
  const first = Object.values(tree.nodes)[0]
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      docId: id,
      parentId: first ? first.id : null,
      anchor: { kind: 'answer', nodeId: first ? first.id : null, quote: (first?.answer || '').slice(0, 60) },
      question: '用一句话总结'
    })
  })
  const text = await res.text()
  const events = text
    .split('\n\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => {
      try {
        return JSON.parse(l.slice(5).trim())
      } catch {
        return null
      }
    })
    .filter(Boolean)
  const done = events.find((e) => e.type === 'done')
  const err = events.find((e) => e.type === 'error')
  const d2 = await (await fetch('/api/doc/' + id)).json()
  const nodes = Object.values(d2.tree.nodes)
  return {
    done: Boolean(done),
    error: err?.message || null,
    nodes: nodes.length,
    childParentOk: nodes.some((n) => n.parentId === (first ? first.id : null)),
    answerLen: done?.node?.answer?.length || 0
  }
})
console.log('follow-up', JSON.stringify(follow))
console.log('errors', errs.slice(0, 4).join(' | ') || '(无)')
await browser.close()
