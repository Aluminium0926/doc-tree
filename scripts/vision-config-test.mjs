import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')

const post = (p, body) =>
  fetch('http://127.0.0.1:4317' + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }).then((r) => r.text())

try {
  await post('/api/config', { visionBaseUrl: 'http://127.0.0.1:4399/v1', visionApiKey: 'vk-test' })
  let cfg = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const set = { visionBaseUrl: cfg.config.visionBaseUrl, hasVisionKey: cfg.config.hasVisionKey, hint: cfg.config.visionKeyHint }

  // 只清 Base URL，不动 Key
  await post('/api/config', { visionBaseUrl: '' })
  cfg = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const cleared = { visionBaseUrl: cfg.config.visionBaseUrl, hasVisionKey: cfg.config.hasVisionKey }

  // UI：设置面板显示并保存
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 }
  })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('dt:seenWelcome', '1'))
  await page.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 600))
  await page.click('#btn-settings')
  await new Promise((r) => setTimeout(r, 300))
  const shown = await page.evaluate(() => ({
    base: document.querySelector('#cfg-vision-base').value,
    model: document.querySelector('#cfg-vision').value,
    keyPlaceholder: document.querySelector('#cfg-vision-key').placeholder
  }))
  await page.evaluate(() => {
    document.querySelector('#cfg-vision-base').value = 'http://127.0.0.1:4399/v1'
  })
  await page.click('#cfg-save')
  await new Promise((r) => setTimeout(r, 800))
  const saved = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  await browser.close()

  console.log(JSON.stringify({ set, cleared, shown, savedVisionBase: saved.config.visionBaseUrl }))
} finally {
  fs.writeFileSync(CONFIG, backup)
}
