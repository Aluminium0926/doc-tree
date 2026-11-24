import fs from 'node:fs'
import WebSocket from 'ws'

const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const target = list.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}, ms = 20000) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    const t = setTimeout(() => {
      pending.delete(mid)
      reject(new Error('timeout'))
    }, ms)
    pending.set(mid, (m) => {
      clearTimeout(t)
      resolve(m)
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
await new Promise((r) => ws.once('open', r))
const res = await send('Runtime.evaluate', {
  expression: `(() => { localStorage.setItem('dt:config', JSON.stringify(${JSON.stringify(cfg)})); return { ok: true, hasKey: !!JSON.parse(localStorage.getItem('dt:config')).apiKey }; })()`,
  returnByValue: true
})
console.log(JSON.stringify(res.result?.result?.value ?? res.result ?? res).slice(0, 300))
ws.close()
