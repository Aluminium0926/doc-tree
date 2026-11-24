import fs from 'node:fs'
import WebSocket from 'ws'

const pdf = fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf').toString('base64')
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
const send = (method, params = {}, timeoutMs = 60000) =>
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
const run = async (expr, ms = 40000) => {
  const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, ms)
  if (m.error) return { cdp: m.error.message }
  if (m.result.exceptionDetails) return { ex: (m.result.exceptionDetails.exception?.description || '').slice(0, 200) }
  return m.result.result?.value
}

console.log('idb', JSON.stringify(await run(`(async () => {
  const t0 = Date.now();
  const db = await new Promise((res, rej) => { const r = indexedDB.open('probe', 1); r.onupgradeneeded = () => r.result.createObjectStore('s', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const blob = new Blob([new Uint8Array(1024)]);
  await new Promise((res, rej) => { const tx = db.transaction('s', 'readwrite'); tx.objectStore('s').put({ id: 'a', blob }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  const got = await new Promise((res, rej) => { const tx = db.transaction('s'); const q = tx.objectStore('s').get('a'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  return { ms: Date.now() - t0, size: got?.blob?.size };
})()`, 20000)))

console.log('shim', JSON.stringify(await run(`({ local: window.DT_LOCAL === true, shim: window.__DT_SHIM === true, hasDoc: typeof window.DTLocal })`)))

console.log('import', JSON.stringify(await run(`(async () => {
  localStorage.setItem('dt:config', JSON.stringify(${JSON.stringify(cfg)}));
  const b64 = ${JSON.stringify(pdf)};
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const t0 = Date.now();
  const r = await fetch('/api/import', { method: 'POST', headers: { 'x-filename': encodeURIComponent('emu.pdf') }, body: u8.buffer });
  const j = await r.json();
  return { status: r.status, ms: Date.now() - t0, j };
})()`, 60000)))
ws.close()
