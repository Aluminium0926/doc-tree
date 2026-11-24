// 生成演示截图（干净数据目录）
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const PORT = process.env.DEMO_PORT || '4421'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = process.argv[2] || 'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/docs/screenshots'

async function importFile(file) {
  const buf = fs.readFileSync(file)
  const r = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent(path.basename(file)) },
    body: buf
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error)
  return j.doc.id
}

async function ask(docId, question, page = 1) {
  const d = await fetch(`${BASE}/api/doc/${docId}`).then((r) => r.json())
  const text = (d.doc.pages.find((p) => p.no === page) || d.doc.pages[0]).text
  const quote = text.slice(0, 100).replace(/\n/g, ' ')
  const res = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, anchor: { kind: 'doc', page, quote }, question })
  })
  const dec = new TextDecoder()
  let buf = ''
  let out = ''
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          const ev = JSON.parse(line.slice(5).trim())
          if (ev.type === 'delta') out += ev.text
          if (ev.type === 'error') throw new Error(ev.message)
        } catch (e) {
          if (e.message && !e.message.startsWith('Unexpected')) throw e
        }
      }
    }
  }
  return { len: out.length }
}

fs.mkdirSync(OUT, { recursive: true })

const md = process.argv[3] || 'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/why-sky-blue.md'
const id = await importFile(md)
console.log('imported', id)
const res = await ask(id, '为什么短波长的蓝光比红光更容易被散射？')
console.log('answered', res.len, 'chars')

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
await page.goto(`${BASE}/?doc=${id}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2500))
await page.screenshot({ path: path.join(OUT, 'reader.png') })

await page.click('#btn-treeview')
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: path.join(OUT, 'tree.png') })

console.log('shots saved to', OUT)
await browser.close()
