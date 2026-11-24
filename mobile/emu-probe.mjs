import WebSocket from 'ws'

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
const send = (method, params = {}, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    const t = setTimeout(() => {
      pending.delete(mid)
      reject(new Error('timeout'))
    }, timeoutMs)
    pending.set(mid, (m) => {
      clearTimeout(t)
      resolve(m)
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
await new Promise((r) => ws.once('open', r))
await send('Runtime.enable')

const ev = async (expression, timeoutMs = 15000) => {
  const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs)
  if (m.error) return { cdpError: m.error.message }
  const r = m.result
  if (r.exceptionDetails) return { ex: r.exceptionDetails.exception?.description?.slice(0, 300) || r.exceptionDetails.text }
  return r.result?.value
}

console.log('ua', JSON.stringify(await ev('navigator.userAgent')))
console.log('polyfill', JSON.stringify(await ev('typeof Promise.withResolvers')))
console.log('pdfjs-import', JSON.stringify(await ev(`import('/vendor/pdf.min.mjs').then(m => typeof m.getDocument).catch(e => 'ERR ' + e.message)`, 20000)))
console.log('worker-test', JSON.stringify(await ev(`(() => { try { const w = new Worker('/vendor/pdf.worker.min.mjs', { type: 'module' }); w.terminate(); return 'ok' } catch (e) { return 'ERR ' + e.message } })()`)))
ws.close()
