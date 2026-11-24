import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes('vendor/pptx')){
  b=b.replace(
    "copy(path.join(here, 'src'), path.join(out, 'src'))",
    `copy(path.join(here, 'src'), path.join(out, 'src'))

// PPTX 前端渲染（A 路线）
const pptxVendor = path.join(out, 'vendor', 'pptx')
fs.mkdirSync(pptxVendor, { recursive: true })
copy(path.join(root, 'node_modules', '@aiden0z', 'pptx-renderer', 'dist', 'aiden0z-pptx-renderer.browser.es.js'), path.join(pptxVendor, 'renderer.js'))
copy(path.join(root, 'node_modules', 'modern-screenshot', 'dist', 'index.mjs'), path.join(pptxVendor, 'screenshot.mjs'))
copy(path.join(root, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.esm.js'), path.join(pptxVendor, 'pdf-lib.js'))`
  )
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('build pptx vendor ok')
