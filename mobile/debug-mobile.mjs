import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4500'
const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 414, height: 896, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`))
page.on('pageerror', (e) => logs.push('[pageerror] ' + String(e.message).slice(0, 300)))
page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url().slice(0, 120) + ' ' + r.failure()?.errorText))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate((c) => localStorage.setItem('dt:config', JSON.stringify(c)), cfg)
await page.reload({ waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))

console.log('shim:', await page.evaluate(() => ({ local: window.DT_LOCAL, shim: window.__DT_SHIM })))

const before = await page.evaluate(() => document.querySelectorAll('#doc-list .doc').length)
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf')
await new Promise((r) => setTimeout(r, 8000))

const after = await page.evaluate(() => ({
  docs: document.querySelectorAll('#doc-list .doc').length,
  pages: document.querySelectorAll('.page').length,
  title: document.querySelector('#doc-title').textContent,
  status: document.querySelector('#status')?.textContent
}))
console.log('before', before, 'after', JSON.stringify(after))
console.log(logs.slice(0, 20).join('\n'))
await page.screenshot({ path: 'mobile-debug.png' })
await browser.close()
