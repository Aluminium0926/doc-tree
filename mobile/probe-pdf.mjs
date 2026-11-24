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
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`))
page.on('pageerror', (e) => logs.push('ERR ' + e.message.slice(0, 200)))

await page.goto('http://127.0.0.1:4500/', { waitUntil: 'domcontentloaded' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
await new Promise((r) => setTimeout(r, 5000))

const out = await page.evaluate(async () => {
  const res = {}
  const st = await (await fetch('/api/state')).json()
  const id = st.docs[0].id
  res.id = id
  const url = await window.DTLocal.fileUrl(id)
  try {
    const pdfjs = await import('/vendor/pdf.min.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs'
    res.hasWorker = Boolean(pdfjs.GlobalWorkerOptions.workerSrc)
    const pdf = await pdfjs.getDocument({ url, cMapUrl: '/vendor/cmaps/', cMapPacked: true }).promise
    res.numPages = pdf.numPages
    const pg = await pdf.getPage(1)
    res.vp = pg.getViewport({ scale: 1 })
  } catch (e) {
    res.error = String(e && (e.stack || e.message))
  }
  return res
})
console.log(JSON.stringify(out, null, 1))
console.log('logs:', logs.slice(-8).join('\n'))
await browser.close()
