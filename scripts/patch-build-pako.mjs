import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes('pako-esm.js')){
  b=b.replace(
    "copy(path.join(root, 'node_modules', '@pdf-lib', 'fontkit', 'dist', 'fontkit.es.min.js'), path.join(pptxVendor, 'fontkit.js'))",
    `copy(path.join(root, 'node_modules', '@pdf-lib', 'fontkit', 'dist', 'fontkit.es.min.js'), path.join(pptxVendor, 'fontkit.js'))
copy(path.join(root, 'node_modules', 'pako', 'dist', 'pako.min.js'), path.join(pptxVendor, 'pako.js'))
fs.writeFileSync(path.join(pptxVendor, 'pako-esm.js'), "import './pako.js'\\nexport default globalThis.pako\\n")
{
  const f = path.join(pptxVendor, 'fontkit.js')
  const s = fs.readFileSync(f, 'utf8').replace(/from"pako"/g, 'from"./pako-esm.js"')
  fs.writeFileSync(f, s)
}`
  )
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('build pako ok')
