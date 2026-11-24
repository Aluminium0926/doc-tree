import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes('libreoffice/browser.js')){
  b=b.replace(
    "copy(path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js'), path.join(out, 'vendor', 'jszip.min.js'))",
    `copy(path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js'), path.join(out, 'vendor', 'jszip.min.js'))

// LibreOffice WASM：PPT/PPTX 转 PDF（只拷一次，体积较大）
const loSrc = path.join(root, 'node_modules', '@matbee', 'libreoffice-converter')
copy(path.join(loSrc, 'dist', 'browser.js'), path.join(out, 'vendor', 'libreoffice', 'browser.js'))
copy(path.join(loSrc, 'dist', 'browser.worker.global.js'), path.join(out, 'vendor', 'libreoffice', 'browser.worker.global.js'))
const wasmSrc = path.join(loSrc, 'wasm')
const wasmOut = path.join(out, 'vendor', 'libreoffice', 'wasm')
fs.mkdirSync(wasmOut, { recursive: true })
for (const f of fs.readdirSync(wasmSrc)) {
  const a = path.join(wasmSrc, f)
  const b2 = path.join(wasmOut, f)
  if (fs.existsSync(b2) && fs.statSync(a).size === fs.statSync(b2).size) continue
  fs.copyFileSync(a, b2)
}`
  )
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('build wasm copy ok')
