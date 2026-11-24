import fs from 'node:fs'
let s = fs.readFileSync('server.mjs', 'utf8')
s = s.replace(
  "    const docs = await store.listDocs()\n    const seen = new Set()",
  "    const docs = await store.listDocs()\n    const groups = await store.listGroups()\n    const groupName = new Map(groups.map((g) => [g.id, g.name]))\n    const seen = new Set()"
)
s = s.replace(
  "        const dkey = doc.groupId ? doc.title : doc.title\n        if (!docMap.has(key)) docMap.set(key, { title: doc.title, total: 0, cacheHit: 0, cacheMiss: 0, requests: 0 })",
  "        if (!docMap.has(key))\n          docMap.set(key, {\n            title: doc.groupId ? groupName.get(doc.groupId) || doc.title : doc.title,\n            total: 0,\n            cacheHit: 0,\n            cacheMiss: 0,\n            requests: 0\n          })"
)
fs.writeFileSync('server.mjs', s)

// HTML：用量弹窗 + 设置入口
let h = fs.readFileSync('public/index.html', 'utf8')
if (!h.includes('id="usage"')) {
  h = h.replace(
    '<div id="update"',
    `<div id="usage" class="modal" hidden>
  <div class="modal-card usage-card">
    <h3>模型用量</h3>
    <div id="usage-body"><p class="usage-empty">加载中…</p></div>
    <div class="modal-actions"><button id="usage-close">关闭</button></div>
  </div>
</div>
<div id="update"`
  )
  h = h.replace(
    '    <p class="welcome-ver" id="settings-ver"></p>',
    '    <p class="welcome-ver" id="settings-ver"></p>\n    <button id="btn-usage" class="ghost usage-open">查看模型用量</button>'
  )
  fs.writeFileSync('public/index.html', h)
}

// CSS
let css = fs.readFileSync('public/style.css', 'utf8')
if (!css.includes('.usage-card')) {
  css += `

/* 用量统计 */
.usage-card { width: 560px; max-height: 80vh; overflow: auto; }
.usage-open { margin: 6px 0 10px; font-size: 11.5px; padding: 5px 12px; }
.usage-total { display: flex; gap: 18px; flex-wrap: wrap; margin: 10px 0 14px; }
.usage-total b { display: block; font-size: 18px; font-weight: 600; }
.usage-total span { font-size: 10.5px; color: var(--dim); }
.usage-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.usage-table th { text-align: left; color: var(--dim); font-weight: 500; padding: 4px 6px; border-bottom: 1px solid var(--line); }
.usage-table td { padding: 4px 6px; border-bottom: 1px solid var(--line); }
.usage-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.usage-sec { margin: 14px 0 4px; font-size: 11px; color: var(--dim); }
.usage-empty { color: var(--dim); font-size: 12px; }
`
  fs.writeFileSync('public/style.css', css)
}

// JS：打开/渲染
let a = fs.readFileSync('public/app.js', 'utf8')
if (!a.includes('function openUsage')) {
  a = a.replace(
    'async function saveSettings() {',
    `async function openUsage() {
  const m = $('#usage')
  if (!m) return
  m.hidden = false
  const body = $('#usage-body')
  body.innerHTML = '<p class="usage-empty">加载中…</p>'
  try {
    const data = await fetch('/api/usage').then((r) => r.json())
    const t = data.totals || {}
    const pct = Math.round((t.hitRate || 0) * 100)
    const fmt = (n) => formatTokens(n)
    const rows = (data.days || [])
      .slice()
      .reverse()
      .map(
        (d) => \`<tr><td>\${esc(d.date)}</td><td class="num">\${fmt(d.total)}</td><td class="num">\${fmt(d.cacheHit)}</td><td class="num">\${d.requests}</td></tr>\`
      )
      .join('')
    const docs = (data.docs || [])
      .map((d) => \`<tr><td>\${esc(d.title)}</td><td class="num">\${fmt(d.total)}</td><td class="num">\${d.requests}</td></tr>\`)
      .join('')
    body.innerHTML = \`
      <div class="usage-total">
        <div><b>\${fmt(t.total)}</b><span>总 tokens</span></div>
        <div><b>\${pct}%</b><span>缓存命中率</span></div>
        <div><b>\${fmt(t.cacheHit)}</b><span>缓存命中</span></div>
        <div><b>\${t.requests || 0}</b><span>提问数</span></div>
      </div>
      <div class="usage-sec">最近 14 天</div>
      <table class="usage-table"><thead><tr><th>日期</th><th class="num">tokens</th><th class="num">缓存命中</th><th class="num">提问</th></tr></thead><tbody>\${rows || '<tr><td colspan="4" class="usage-empty">还没有记录</td></tr>'}</tbody></table>
      <div class="usage-sec">按文档</div>
      <table class="usage-table"><thead><tr><th>文档</th><th class="num">tokens</th><th class="num">提问</th></tr></thead><tbody>\${docs || '<tr><td colspan="3" class="usage-empty">还没有记录</td></tr>'}</tbody></table>\`
  } catch (e) {
    body.innerHTML = '<p class="usage-empty">加载失败：' + esc(String(e.message || e)) + '</p>'
  }
}

async function saveSettings() {`
  )
  a = a.replace(
    "  $('#cfg-save').addEventListener('click', saveSettings)",
    "  $('#cfg-save').addEventListener('click', saveSettings)\n  $('#btn-usage')?.addEventListener('click', openUsage)\n  $('#usage-close')?.addEventListener('click', () => ($('#usage').hidden = true))\n  $('#usage')?.addEventListener('click', (e) => { if (e.target.id === 'usage') $('#usage').hidden = true })"
  )
  fs.writeFileSync('public/app.js', a)
}
console.log('usage ui ok')
