// 构建演示数据并出图：md 三节点树 + pdf 截图
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const PORT = process.env.DEMO_PORT || '4421'
const BASE = `http://127.0.0.1:${PORT}`
const OUT = 'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/docs/screenshots'
const EX = 'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples'

fs.mkdirSync(OUT, { recursive: true })

function cleanQuote(s) {
  return String(s || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\$[^$]*\$/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

async function importFile(file) {
  const r = await fetch(`${BASE}/api/import`, {
    method: 'POST',
    headers: { 'x-filename': encodeURIComponent(path.basename(file)) },
    body: fs.readFileSync(file)
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error)
  return j.doc.id
}

async function ask(docId, { question, anchor, parentId }) {
  const res = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, question, anchor, parentId })
  })
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  let nodeId = null
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
          if (ev.type === 'meta') nodeId = ev.node.id
          if (ev.type === 'delta') text += ev.text
          if (ev.type === 'error') throw new Error(ev.message)
        } catch (e) {
          if (e.message && !e.message.startsWith('Unexpected')) throw e
        }
      }
    }
  }
  return { nodeId, text }
}

async function docText(docId, page = 1) {
  const d = await fetch(`${BASE}/api/doc/${docId}`).then((r) => r.json())
  return (d.doc.pages.find((p) => p.no === page) || d.doc.pages[0]).text
}

// ---- markdown ----
const mdId = await importFile(`${EX}/why-sky-blue.md`)
const mdText = await docText(mdId)
const sec2 = mdText.slice(mdText.indexOf('当散射粒子'), mdText.indexOf('当散射粒子') + 80)
const sec4 = mdText.slice(mdText.indexOf('太阳低垂时'), mdText.indexOf('太阳低垂时') + 80)

const q1 = await ask(mdId, {
  question: '为什么短波长的蓝光比红光更容易被散射？',
  anchor: { kind: 'doc', page: 1, quote: cleanQuote(sec2) }
})
console.log('Q1', q1.nodeId, q1.text.length)

const q2 = await ask(mdId, {
  question: '用更直白的话讲讲，为什么是四次方而不是平方？',
  parentId: q1.nodeId,
  anchor: { kind: 'answer', nodeId: q1.nodeId, quote: cleanQuote(q1.text) }
})
console.log('Q2', q2.nodeId, q2.text.length)

const q3 = await ask(mdId, {
  question: '傍晚变成红色，也是同一个原因吗？',
  anchor: { kind: 'doc', page: 1, quote: cleanQuote(sec4) }
})
console.log('Q3', q3.nodeId, q3.text.length)

// ---- pdf ----
const pdfId = await importFile(`${EX}/four-seasons.pdf`)
console.log('pdf', pdfId)

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1500, height: 950 }
})
const page = await browser.newPage()
await page.goto(`${BASE}/?doc=${mdId}`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 2500))
await page.screenshot({ path: path.join(OUT, 'reader.png') })
await page.click('#btn-treeview')
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: path.join(OUT, 'tree.png') })

// PDF 页：先问一个问题，再标一条高亮
const pdfText = await docText(pdfId)
await ask(pdfId, {
  question: '这一段在讲什么？',
  anchor: { kind: 'doc', page: 1, quote: cleanQuote(pdfText) }
})

await page.goto(`${BASE}/?doc=${pdfId}`, { waitUntil: 'networkidle2' })
await page.waitForSelector('.page canvas')
await new Promise((r) => setTimeout(r, 2200))
// 打开荧光笔并高亮一段
await page.click('#btn-hl')
await page.evaluate(() => {
  const layer = document.querySelector('.page[data-page="1"] .textLayer')
  if (!layer) return
  const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim())
  if (spans.length < 6) return
  const r = document.createRange()
  r.setStart(spans[2].firstChild, 0)
  r.setEnd(spans[4].firstChild, spans[4].firstChild.length)
  const sel = getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 600))
await page.click('#btn-hl')
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: path.join(OUT, 'pdf.png') })

console.log('done')
await browser.close()
