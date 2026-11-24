import fs from 'node:fs'
import path from 'node:path'
const out='mobile/www/vendor/pptx'
fs.mkdirSync(out,{recursive:true})
for(const [from,to] of [
  ['node_modules/@aiden0z/pptx-renderer/dist/aiden0z-pptx-renderer.browser.es.js','renderer.js'],
  ['node_modules/modern-screenshot/dist/index.mjs','screenshot.mjs'],
  ['node_modules/pdf-lib/dist/pdf-lib.esm.js','pdf-lib.js']
]) fs.copyFileSync(from,path.join(out,to))
console.log('copied A assets', fs.readdirSync(out).map(f=>f+':'+Math.round(fs.statSync(path.join(out,f)).size/1024)+'KB').join(', '))
