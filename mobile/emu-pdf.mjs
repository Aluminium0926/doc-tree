import fs from 'node:fs'
import WebSocket from 'ws'

const pdf = fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf').toString('base64')
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
const send = (method, params = {}, timeoutMs = 40000) =>
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

const expr = `(async () => {
  const m = await import('/vendor/pdf.min.mjs');
  const b64 = ${JSON.stringify(pdf)};
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const out = {};
  for (const mode of ['worker', 'fake']) {
    try {
      if (mode === 'worker') m.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
      else m.GlobalWorkerOptions.workerSrc = '';
      const t0 = Date.now();
      const task = m.getDocument({ data: u8.slice(0), cMapUrl: '/vendor/cmaps/', cMapPacked: true, isEvalSupported: false });
      const pdf = await Promise.race([task.promise, new Promise((_, rej) => setTimeout(() => rej(new Error('parse timeout')), 12000))]);
      out[mode] = { pages: pdf.numPages, ms: Date.now() - t0 };
      await pdf.destroy();
    } catch (e) {
      out[mode] = 'ERR ' + (e && e.message);
    }
  }
  return out;
})()`

const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, 60000)
console.log(JSON.stringify(m.result?.value ?? m, null, 1).slice(0, 800))
ws.close()
