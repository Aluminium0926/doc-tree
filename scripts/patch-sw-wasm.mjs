import fs from 'node:fs'
let s=fs.readFileSync('mobile/sw.js','utf8')
s=s.replace(
  "  if (url.pathname.startsWith('/proxy/') || url.pathname.startsWith('/api/')) return",
  "  if (url.pathname.startsWith('/proxy/') || url.pathname.startsWith('/api/')) return\n  // LibreOffice WASM 体积很大，交给浏览器缓存，避免 Service Worker 克隆 200MB 响应\n  if (url.pathname.startsWith('/vendor/libreoffice/')) return"
)
fs.writeFileSync('mobile/sw.js',s)
console.log('sw skip wasm ok')
