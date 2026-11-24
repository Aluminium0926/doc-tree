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
page.on('pageerror', (e) => logs.push('ERR ' + e.message.slice(0, 200)))
page.on('console', (m) => {
  if (m.type() === 'error') logs.push('CERR ' + m.text().slice(0, 200))
})

await page.goto('http://127.0.0.1:4500/', { waitUntil: 'domcontentloaded' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))

const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
await new Promise((r) => setTimeout(r, 6000))

const probe = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const id = st.docs[0]?.id
  let docInfo = null
  let url = null
  let urlErr = null
  let urlStatus = null
  if (id) {
    const d = await (await fetch('/api/doc/' + id)).json()
    docInfo = { pages: d.doc?.pages?.length, kind: d.doc?.kind, first: (d.doc?.pages?.[0]?.text || '').slice(0, 40) }
    try {
      url = await window.DTLocal.fileUrl(id)
    } catch (e) {
      urlErr = String(e.message)
    }
    if (url) {
      try {
        const r = await fetch(url)
        urlStatus = r.status + ' ' + r.headers.get('content-type')
      } catch (e) {
        urlStatus = 'fetch err ' + e.message
      }
    }
  }
  return {
    docs: st.docs.length,
    id,
    docInfo,
    urlHead: url ? url.slice(0, 32) : null,
    urlErr,
    urlStatus,
    pages: document.querySelectorAll('.page').length,
    docItems: document.querySelectorAll('.doc-item').length,
    toolbar: !!document.querySelector('#toolbar'),
    pagesHtml: document.querySelector('#pages').innerHTML.slice(0, 100)
  }
})
console.log(JSON.stringify(probe, null, 1))
console.log('logs:', logs.slice(0, 6).join(' | ') || '(无)')
await browser.close()
