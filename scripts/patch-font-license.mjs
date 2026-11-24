import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes('NotoSansSC-LICENSE')){
  b=b.replace(
    "copy(path.join(here, 'NotoSansSC.woff2'), path.join(pptxVendor, 'NotoSansSC.woff2'))",
    "copy(path.join(here, 'NotoSansSC.woff2'), path.join(pptxVendor, 'NotoSansSC.woff2'))\ncopy(path.join(here, 'NotoSansSC-LICENSE.txt'), path.join(pptxVendor, 'NotoSansSC-LICENSE.txt'))"
  )
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('license bundled')
