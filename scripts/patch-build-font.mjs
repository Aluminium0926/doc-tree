import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes('NotoSansSC.woff2')){
  b=b.replace(
    "copy(path.join(root, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.esm.js'), path.join(pptxVendor, 'pdf-lib.js'))",
    `copy(path.join(root, 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.esm.js'), path.join(pptxVendor, 'pdf-lib.js'))
copy(path.join(root, 'node_modules', '@pdf-lib', 'fontkit', 'dist', 'fontkit.es.min.js'), path.join(pptxVendor, 'fontkit.js'))
copy(path.join(here, 'NotoSansSC.woff2'), path.join(pptxVendor, 'NotoSansSC.woff2'))`
  )
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('build font assets ok')
