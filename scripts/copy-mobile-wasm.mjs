import fs from 'node:fs'
import path from 'node:path'
const src='node_modules/@matbee/libreoffice-converter'
const out='mobile/www/vendor/libreoffice'
fs.mkdirSync(out,{recursive:true})
for(const f of ['browser.js','browser.worker.global.js']){
  fs.copyFileSync(path.join(src,'dist',f),path.join(out,f))
}
const wasmIn=path.join(src,'wasm'), wasmOut=path.join(out,'wasm')
fs.mkdirSync(wasmOut,{recursive:true})
for(const f of fs.readdirSync(wasmIn)){
  const a=path.join(wasmIn,f), b=path.join(wasmOut,f)
  if(fs.existsSync(b) && fs.statSync(a).size===fs.statSync(b).size) continue
  fs.copyFileSync(a,b)
}
console.log('copied', fs.readdirSync(wasmOut).length, 'wasm files', Math.round(fs.readdirSync(wasmOut).reduce((s,f)=>s+fs.statSync(path.join(wasmOut,f)).size,0)/1024/1024),'MB')
