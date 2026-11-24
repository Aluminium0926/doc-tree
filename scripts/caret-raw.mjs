import fs from 'node:fs'
import WebSocket from 'ws'

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const page = list.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, (m) => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

await new Promise((r) => ws.once('open', r))
await send('Runtime.enable')
await send('Page.enable')

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.value
}

const info = await evalJs(`(() => {
  const q = document.querySelector('#q')
  q.focus()
  const cs = getComputedStyle(q)
  const r = q.getBoundingClientRect()
  return { active: document.activeElement.id, focused: document.hasFocus(), caretColor: cs.caretColor, color: cs.color, opacity: cs.opacity, x: r.x, y: r.y, w: r.width, h: r.height }
})()`)
console.log('info', JSON.stringify(info))

await send('Input.insertText', { text: 'abc' })
await new Promise((r) => setTimeout(r, 200))

for (let i = 0; i < 4; i++) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(`caret-live-${i}.png`, Buffer.from(shot.data, 'base64'))
  await new Promise((r) => setTimeout(r, 260))
}
console.log('value', await evalJs(`document.querySelector('#q').value`))
ws.close()
