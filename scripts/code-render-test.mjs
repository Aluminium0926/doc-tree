import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4317'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 950 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))
const input = await page.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/mobile/fixtures/code-test.md')
await page.waitForSelector('.code-card', { timeout: 30000 })
await new Promise((r) => setTimeout(r, 1200))

const info = await page.evaluate(() => ({
  cards: document.querySelectorAll('.code-card').length,
  langs: [...document.querySelectorAll('.code-lang')].map((e) => e.textContent),
  highlighted: document.querySelectorAll('.code-card code.hljs').length,
  copyBtns: document.querySelectorAll('.code-btn').length,
  firstCode: document.querySelector('.code-card code')?.innerText.slice(0, 40)
}))
console.log(JSON.stringify(info))
console.log('errors:', errs.join(' | ') || '(无)')
const card = await page.$('.code-card')
await card.screenshot({ path: 'code-card.png' })
await browser.close()
