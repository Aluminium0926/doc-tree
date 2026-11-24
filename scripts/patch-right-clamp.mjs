import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
`  if (v && !wasCollapsed) {
    // 收起时不让右栏趁机变宽，把空间留给文档
    app.style.setProperty('--right', Math.round(rNow) + 'px')
  } else {
    applySavedWidths()
  }`,
`  applySavedWidths()`
)
a=a.replace(
`  // 先压缩右栏，保证文档区至少 320px
  r = Math.min(r, Math.max(260, Math.min(900, W - (collapsed ? 0 : l) - minViewer)))`,
`  // 窄窗口先限制右栏占比，否则收起左栏后文档区仍然很窄
  if (W < 1180) r = Math.min(r, Math.max(280, Math.round(W * 0.38)))
  // 再压缩右栏，保证文档区至少 320px
  r = Math.min(r, Math.max(260, Math.min(900, W - (collapsed ? 0 : l) - minViewer)))`
)
fs.writeFileSync('public/app.js',a)
console.log('right clamp ok')
