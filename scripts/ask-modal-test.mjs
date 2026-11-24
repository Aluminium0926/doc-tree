import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 }
})
const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)))
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 800))

// 第一次：弹窗
await page.click('#doc-list .doc-item:not(.archived) .x')
await new Promise((r) => setTimeout(r, 300))
const modal = await page.evaluate(() => ({
  visible: !document.querySelector('#ask').hidden,
  text: document.querySelector('#ask-text').textContent.slice(0, 40),
  never: !!document.querySelector('#ask-never')
}))
await page.screenshot({ path: 'ask-modal.png' })

// 勾选“下次不再提示”并确认
await page.click('#ask-never')
await page.click('#ask-ok')
await new Promise((r) => setTimeout(r, 500))
const afterFirst = await page.evaluate(() => ({
  arch: document.querySelectorAll('#doc-list .doc-item.archived').length,
  flag: localStorage.getItem('dt:noAskRemove')
}))

// 第二次：应直接移出，不再弹窗
await page.click('#doc-list .doc-item:not(.archived) .x')
await new Promise((r) => setTimeout(r, 500))
const second = await page.evaluate(() => ({
  modal: !document.querySelector('#ask').hidden,
  arch: document.querySelectorAll('#doc-list .doc-item.archived').length
}))

// 设置里恢复提示
await page.click('#btn-settings')
await new Promise((r) => setTimeout(r, 300))
const setting = await page.evaluate(() => document.querySelector('#cfg-ask-remove').checked)
await page.click('#cfg-ask-remove')
const settingAfter = await page.evaluate(() => localStorage.getItem('dt:noAskRemove'))
console.log(JSON.stringify({ modal, afterFirst, second, setting, settingAfter, errs }))
await browser.close()
