// 在真实 WebView 里跑一遍：配置 → 导入 PDF → 提问 → 流式回答
import fs from 'node:fs'
import WebSocket from 'ws'

const cfg = JSON.parse(fs.readFileSync('data/config.json', 'utf8'))
const pdf = fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree-public/examples/four-seasons.pdf').toString('base64')

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const target = list.find((t) => t.type === 'page')
if (!target) throw new Error('no page target')
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
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, (m) => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
await new Promise((r) => ws.once('open', r))
await send('Runtime.enable')

const expr = `(async () => {
  const cfg = ${JSON.stringify(cfg)};
  localStorage.setItem('dt:config', JSON.stringify(cfg));
  const b64 = ${JSON.stringify(pdf)};
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const t0 = Date.now();
  const imp = await fetch('/api/import', { method: 'POST', headers: { 'x-filename': encodeURIComponent('emu.pdf') }, body: u8.buffer });
  const j = await imp.json();
  const importMs = Date.now() - t0;
  const st = await (await fetch('/api/state')).json();
  const docId = st.docs[0].id;
  const d = await (await fetch('/api/doc/' + docId)).json();
  const quote = (d.doc.pages[0].text || '').slice(0, 60);
  const t1 = Date.now();
  const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ docId, anchor: { kind: 'doc', page: 1, quote }, question: '用一句话说明这份文档的主旨' }) });
  const text = await res.text();
  const askMs = Date.now() - t1;
  const evs = text.split('\\n\\n').filter((l) => l.startsWith('data:')).map((l) => { try { return JSON.parse(l.slice(5).trim()) } catch { return null } }).filter(Boolean);
  const done = evs.find((e) => e.type === 'done');
  const err = evs.find((e) => e.type === 'error');
  return { importOk: imp.ok, pages: d.doc.pages.length, bytes: j.doc.bytes, importMs, askMs, answerLen: done?.node?.answer?.length || 0, error: err?.message || null, deltaCount: evs.filter((e) => e.type === 'delta').length };
})()`

const probe = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })
console.log('probe', JSON.stringify(probe))

const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
console.log('raw', JSON.stringify(r).slice(0, 1200))
ws.close()
