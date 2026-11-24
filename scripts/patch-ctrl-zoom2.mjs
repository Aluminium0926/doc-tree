import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
const anchor = "    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {"
const block = `    // Ctrl/Cmd +/- 缩放页面，Ctrl/Cmd 0 回到 100%
    if ((e.ctrlKey || e.metaKey) && !e.altKey && S.doc) {
      const k = e.key
      const cur = zoomPreviewZ ?? S.zoom
      if (k === '=' || k === '+') {
        e.preventDefault()
        previewZoom(cur * 1.12)
        return
      }
      if (k === '-' || k === '_') {
        e.preventDefault()
        previewZoom(cur / 1.12)
        return
      }
      if (k === '0') {
        e.preventDefault()
        previewZoom(1)
        return
      }
    }
`
if (!t.includes('Ctrl/Cmd +/- 缩放页面')) {
  t = t.replace(anchor, block + anchor)
}
fs.writeFileSync(F, t)
console.log(t.includes('Ctrl/Cmd +/- 缩放页面') ? 'bound' : 'failed')
