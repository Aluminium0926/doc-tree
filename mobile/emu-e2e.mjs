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
const send = (method, params = {}, timeoutMs = 90000) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    const t = setTimeout(() => {
      pending.delete(mid)
      reject(new Error('timeout ' + method))
    }, timeoutMs)
    pending.set(mid, (m) => {
      clearTimeout(t)
      resolve(m)
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
await new Promise((r) => ws.once('open', r))
await send('Runtime.enable')
await send('Page.enable')
await send('Page.reload', {}, 20000)
await new Promise((r) => setTimeout(r, 5000))

const run = async (expr, ms = 90000) => {
  const m = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, ms)
  if (m.error) return { cdp: m.error.message }
  if (m.result.exceptionDetails) return { ex: (m.result.exceptionDetails.exception?.description || '').slice(0, 240) }
  return m.result.result?.value
}

console.log('ready', JSON.stringify(await run(`({ local: window.DT_LOCAL, shim: window.__DT_SHIM, ua: navigator.userAgent.slice(-40) })`)))

const imp = await run(`(async () => {
  localStorage.setItem('dt:config', JSON.stringify(${JSON.stringify(cfg)}));
  const b64 = ${JSON.stringify(pdf)};
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const t0 = Date.now();
  const r = await fetch('/api/import', { method: 'POST', headers: { 'x-filename': encodeURIComponent('emu.pdf') }, body: u8.buffer });
  const j = await r.json();
  const st = await (await fetch('/api/state')).json();
  return { status: r.status, ms: Date.now() - t0, docs: st.docs.length, j };
})()`, 90000)
console.log('IMPORT', JSON.stringify(imp).slice(0, 400))

const ask = await run(`(async () => {
  const st = await (await fetch('/api/state')).json();
  const docId = st.docs[0].id;
  const d = await (await fetch('/api/doc/' + docId)).json();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 50000);
  const t0 = Date.now();
  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac.signal, body: JSON.stringify({ docId, anchor: { kind: 'doc', page: 1, quote: (d.doc.pages[0].text || '').slice(0, 60) }, question: '用一句话说明主旨' }) });
    const text = await res.text();
    clearTimeout(timer);
    const evs = text.split('\\n\\n').filter((l) => l.startsWith('data:')).map((l) => { try { return JSON.parse(l.slice(5).trim()) } catch { return null } }).filter(Boolean);
    const done = evs.find((e) => e.type === 'done');
    const err = evs.find((e) => e.type === 'error');
    return { ok: res.ok, ms: Date.now() - t0, deltas: evs.filter((e) => e.type === 'delta').length, answerLen: done?.node?.answer?.length || 0, error: err?.message || null };
  } catch (e) {
    return { aborted: true, ms: Date.now() - t0, error: String(e.message) };
  }
})()`, 90000)
console.log('ASK', JSON.stringify(ask))
ws.close()
