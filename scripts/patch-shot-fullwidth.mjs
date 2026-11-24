import fs from 'node:fs'

// 1) 取消 fit-content / 固定宽度：让截图占满整行，超宽裁右
let css = fs.readFileSync('public/style.css', 'utf8')
css = css.replace('#shot-chip { width: fit-content; max-width: 100%; min-width: 0; }', '#shot-chip { width: 100%; max-width: 100%; min-width: 0; }')
css = css.replace(
  `.shot-thumb {
  display: block; flex: 0 1 auto;
  max-width: min(280px, 100%);
  overflow: hidden;
  border-radius: 7px;
  border: 1px solid var(--line);
  line-height: 0;
}`,
  `.shot-thumb {
  display: block; flex: 1 1 auto;
  min-width: 0; max-width: none;
  height: 64px; max-height: 64px;
  overflow: hidden;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--panel-3);
  line-height: 0;
}`
)
css = css.replace(
  `.shot-thumb img {
  display: block;
  max-height: 64px;
  max-width: none;
  width: auto;
  height: auto;
}`,
  `.shot-thumb img {
  display: block;
  height: 64px;
  width: auto;
  max-width: none;
  max-height: none;
}`
)
fs.writeFileSync('public/style.css', css)

// 2) 去掉 JS 里的固定宽度，否则会盖住 flex
let js = fs.readFileSync('public/app.js', 'utf8')
js = js.replace(
  `    const img = sh.querySelector('img')
    const thumb = sh.querySelector('.shot-thumb')
    img.onload = () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw || !nh) return
      // 按 64px 高换算显示宽度；超过 280 就裁掉右边，并把容器钉死这个宽度
      const dispW = nw * Math.min(1, 64 / nh)
      thumb.style.width = Math.min(280, Math.round(dispW)) + 'px'
    }
    img.src = S.pendingShot`,
  `    sh.querySelector('img').src = S.pendingShot`
)

// 3) 状态文案与实际一致
js = js.replace("if (S.shotMode) setStatus('拖拽框选区域，松手自动发送')", "if (S.shotMode) setStatus('拖拽框选区域，松手后带到输入框')")
fs.writeFileSync('public/app.js', js)

// 4) 按钮悬停提示
let h = fs.readFileSync('public/index.html', 'utf8')
h = h.replace(/id="btn-shot"[^>]*title="[^"]*"/, (m) => m.replace(/title="[^"]*"/, 'title="框选截图（拖拽后带到输入框）"'))
fs.writeFileSync('public/index.html', h)
console.log('shot full-width + copy fixed')
