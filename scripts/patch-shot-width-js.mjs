import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `  const sh = $('#shot-chip')
  if (S.pendingShot) {
    sh.hidden = false
    sh.querySelector('img').src = S.pendingShot
  } else {
    sh.hidden = true
  }`,
  `  const sh = $('#shot-chip')
  if (S.pendingShot) {
    sh.hidden = false
    const img = sh.querySelector('img')
    const thumb = sh.querySelector('.shot-thumb')
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw || !nh) return
      // 按 64px 高换算显示宽度；超过 280 就裁掉右边，并把容器钉死这个宽度
      const dispW = nw * Math.min(1, 64 / nh)
      thumb.style.width = Math.min(280, Math.round(dispW)) + 'px'
    }
    img.src = S.pendingShot
  } else {
    sh.hidden = true
  }`
)
fs.writeFileSync(F, t)
console.log('shot thumb width pinned')
