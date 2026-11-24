// Electron 焦点实验台：通过 CDP 在真实应用窗口里操作/读数
// 子命令：
//   node scripts/electron-lab.mjs read
//   node scripts/electron-lab.mjs arm                 # 安装焦点事件日志
//   node scripts/electron-lab.mjs front               # 激活窗口
//   node scripts/electron-lab.mjs click <x> <y>
//   node scripts/electron-lab.mjs clickSel <css>
//   node scripts/electron-lab.mjs type <text>
//   node scripts/electron-lab.mjs press <key>
//   node scripts/electron-lab.mjs ime <text>          # 模拟中文输入法提交
//   node scripts/electron-lab.mjs eval <js>
//   node scripts/electron-lab.mjs shot <file.png>
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const PORT = process.env.CDP_PORT || 9222
const [cmd, ...rest] = process.argv.slice(2)

const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const pages = await browser.pages()
const page = pages.find((p) => p.url().includes('127.0.0.1'))
if (!page) {
  console.log('no app page')
  await browser.disconnect()
  process.exit(1)
}

const idOf = `(el) => (!el ? null : el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName)`

const read = async (label = '') => {
  const s = await page.evaluate(`(() => {
    const idOf = ${idOf}
    const q = document.querySelector('#q')
    const ae = document.activeElement
    return {
      hasFocus: document.hasFocus(),
      vis: document.visibilityState,
      ae: idOf(ae),
      qFocused: ae === q,
      qValue: q ? q.value : null,
      caret: q ? [q.selectionStart, q.selectionEnd] : null,
      modals: [...document.querySelectorAll('.modal:not([hidden])')].map(m => m.id),
      chip: document.querySelector('#anchor-chip') ? !document.querySelector('#anchor-chip').hidden && getComputedStyle(document.querySelector('#anchor-chip')).display !== 'none' : null,
      log: window.__fLog || null
    }
  })()`)
  console.log((label ? label + ' ' : '') + JSON.stringify(s))
  return s
}

switch (cmd) {
  case 'read':
    await read()
    break
  case 'arm':
    await page.evaluate(`(() => {
      window.__fLog = []
      const push = (t) => window.__fLog.push(t + ' @' + Math.round(performance.now()))
      addEventListener('focus', () => push('window:focus'))
      addEventListener('blur', () => push('window:blur'))
      document.addEventListener('visibilitychange', () => push('vis:' + document.visibilityState))
      document.addEventListener('focusin', (e) => push('focusin:' + (e.target.id || e.target.className || e.target.tagName)))
      document.addEventListener('focusout', (e) => push('focusout:' + (e.target.id || e.target.className || e.target.tagName)))
      return true
    })()`)
    console.log('armed')
    break
  case 'front':
    await page.bringToFront()
    await new Promise((r) => setTimeout(r, 400))
    await read('after bringToFront')
    break
  case 'click':
    await page.mouse.click(Number(rest[0]), Number(rest[1]))
    await new Promise((r) => setTimeout(r, 250))
    await read('after click')
    break
  case 'clickSel': {
    const box = await page.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(rest[0])})
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
    })()`)
    if (!box) { console.log('not found: ' + rest[0]); break }
    await page.mouse.move(box.x, box.y)
    await new Promise((r) => setTimeout(r, 120))
    await page.mouse.click(box.x, box.y)
    await new Promise((r) => setTimeout(r, 250))
    await read('after clickSel ' + rest[0])
    break
  }
  case 'type':
    await page.keyboard.type(rest.join(' '))
    await new Promise((r) => setTimeout(r, 200))
    await read('after type')
    break
  case 'press':
    await page.keyboard.press(rest[0])
    await new Promise((r) => setTimeout(r, 200))
    await read('after press ' + rest[0])
    break
  case 'ime': {
    const cdp = await page.createCDPSession()
    const text = rest.join(' ')
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 229, key: 'Process' })
    await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length })
    await new Promise((r) => setTimeout(r, 80))
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 229, key: 'Enter', text: '\r' })
    await cdp.send('Input.insertText', { text })
    await new Promise((r) => setTimeout(r, 200))
    await cdp.detach()
    await read('after ime')
    break
  }
  case 'eval': {
    const out = await page.evaluate(`(async () => { ${rest.join(' ')} })()`)
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1))
    break
  }
  case 'shot': {
    const b64 = await page.screenshot({ encoding: 'base64' })
    fs.writeFileSync(rest[0], Buffer.from(b64, 'base64'))
    console.log('saved ' + rest[0])
    break
  }
  default:
    console.log('unknown command: ' + cmd)
}

await browser.disconnect()
