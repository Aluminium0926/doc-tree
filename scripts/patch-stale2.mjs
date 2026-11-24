import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `  const v = S.serverVersion
  if (!v || v === APP_VERSION) {
    el.hidden = true
    return
  }
  $('#stale-text').textContent = \`服务端版本 \${v}，界面版本 \${APP_VERSION}：代码已更新，但服务端还在用旧版本。请完全退出应用后重新打开（Ctrl+R 只刷新界面，不会重载服务端）。\``,
  `  const v = S.serverVersion
  const isWeb = window.DT_LOCAL === true
  if (!isWeb && !v) {
    $('#stale-text').textContent = '当前界面已更新，但服务端仍在运行旧代码（未返回版本号）。请完全退出应用后重新打开——Ctrl+R 只刷新界面，不会重载服务端。'
    el.hidden = false
    return
  }
  if (!v || v === APP_VERSION) {
    el.hidden = true
    return
  }
  $('#stale-text').textContent = \`服务端版本 \${v}，界面版本 \${APP_VERSION}：代码已更新，但服务端还在用旧版本。请完全退出应用后重新打开（Ctrl+R 只刷新界面，不会重载服务端）。\``
)
fs.writeFileSync(F, t)
console.log('patched')
