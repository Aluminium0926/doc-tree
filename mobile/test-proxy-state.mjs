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
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
await page.waitForSelector('.page canvas', { timeout: 60000 })
// 等后台摘要跑完，会经过 /proxy/llm
await new Promise((r) => setTimeout(r, 4000))
console.log('proxy state', await page.evaluate(() => window.__DT_PROXY_STATE))
const summary = await page.evaluate(async () => {
  const st = await (await fetch('/api/state')).json()
  const d = await (await fetch('/api/doc/' + st.docs[0].id)).json()
  return { hasSummary: Boolean(d.doc.summary), len: (d.doc.summary || '').length }
})
console.log('summary', JSON.stringify(summary))
await browser.close()
