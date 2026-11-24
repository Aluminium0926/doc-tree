import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
  "  const dpr = Math.min(1.5, window.devicePixelRatio || 1)",
  "  // 缩小查看时文字很小，保留完整屏幕像素比；放大到 120% 以上再限制，兼顾清晰度和内存\n  const dpr = Math.min(window.devicePixelRatio || 1, S.zoom > 1.2 ? 1.5 : 2)"
)
a=a.replace(
  "    sc.scrollTop = Math.round(ratio * max2)\n    if (relayoutAgain) {",
  "    sc.scrollTop = Math.round(ratio * max2)\n    scheduleHeal(0)\n    if (relayoutAgain) {"
)
fs.writeFileSync('public/app.js',a)
console.log('adaptive dpr ok')
