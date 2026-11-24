import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const post = (p, b) => fetch('http://127.0.0.1:4317' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
try {
  await post('/api/config', { apiFormat: 'anthropic', visionFormat: 'anthropic' })
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'], defaultViewport: { width: 1440, height: 900 } })
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
  await p.evaluate(() => localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({ waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 600))
  await p.click('#btn-settings')
  await new Promise(r => setTimeout(r, 300))
  const shown = await p.evaluate(() => ({ f: document.querySelector('#cfg-format').value, vf: document.querySelector('#cfg-vision-format').value }))
  await p.select('#cfg-format', 'openai')
  await p.click('#cfg-save')
  await new Promise(r => setTimeout(r, 800))
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
  console.log(JSON.stringify({ shown, saved: { apiFormat: cfg.apiFormat, visionFormat: cfg.visionFormat } }))
  await b.close()
} finally {
  fs.writeFileSync(CONFIG, backup)
}
