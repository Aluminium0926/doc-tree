import fs from 'node:fs'
// 1) server: 暴露启动时的版本
let s = fs.readFileSync('server.mjs', 'utf8')
if (!s.includes('SERVER_VERSION')) {
  const anchor = "const PUBLIC = path.join(__dirname, 'public')"
  const vblock = `const SERVER_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version
  } catch {
    return '0.0.0'
  }
})()

`
  s = s.replace(anchor, vblock + anchor)
  s = s.replace("return json(res, 200, { docs: await store.listDocs(), config: llm.publicConfig() })", "return json(res, 200, { docs: await store.listDocs(), config: llm.publicConfig(), serverVersion: SERVER_VERSION })")
  fs.writeFileSync('server.mjs', s)
  console.log('server version exposed')
}

// 2) 前端：状态里保存 serverVersion，并在初始化时检查
let a = fs.readFileSync('public/app.js', 'utf8')
a = a.replace("  S.cfg = r.config || {}", "  S.cfg = r.config || {}\n  S.serverVersion = r.serverVersion || ''")
if (!a.includes('function checkStaleServer')) {
  const fn = `
function checkStaleServer() {
  const el = $('#stale')
  if (!el) return
  const v = S.serverVersion
  if (!v || v === APP_VERSION) {
    el.hidden = true
    return
  }
  $('#stale-text').textContent = \`服务端版本 \${v}，界面版本 \${APP_VERSION}：代码已更新，但服务端还在用旧版本。请完全退出应用后重新打开（Ctrl+R 只刷新界面，不会重载服务端）。\`
  el.hidden = false
}

`
  a = a.replace('async function loadState() {', fn + 'async function loadState() {')
  a = a.replace("  paintRange($('#effort'))\n}", "  paintRange($('#effort'))\n  checkStaleServer()\n}")
  a = a.replace("  $('#btn-send').addEventListener('click', () => send())", "  $('#btn-send').addEventListener('click', () => send())\n  $('#stale-x')?.addEventListener('click', () => { const el = $('#stale'); if (el) el.hidden = true })")
}
fs.writeFileSync('public/app.js', a)
console.log('frontend check wired')
