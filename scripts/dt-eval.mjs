// 在正在运行的 Electron 应用里执行一段 JS 表达式并打印结果
// 用法：node scripts/dt-eval.mjs "document.hasFocus()"
//      node scripts/dt-eval.mjs --file 某脚本.js
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const PORT = process.env.CDP_PORT || 9222
const args = process.argv.slice(2)
let expr = args[0] || '1'
if (expr === '--file') expr = fs.readFileSync(args[1], 'utf8')

const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1'))
if (!page) {
  console.log('no app page')
  await browser.disconnect()
  process.exit(1)
}
try {
  const out = await page.evaluate(`(async () => { ${expr} })()`)
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1))
} catch (e) {
  console.log('EVAL ERROR: ' + e.message)
}
await browser.disconnect()
