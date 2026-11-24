import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
const start=b.indexOf("\n// LibreOffice WASM")
if(start>=0){
  const end=b.indexOf("// 子路径部署",start)
  b=b.slice(0,start)+'\n\n'+b.slice(end)
  fs.writeFileSync('mobile/build.mjs',b)
}
let s=fs.readFileSync('mobile/static-server.mjs','utf8')
s=s.replace("      'cross-origin-opener-policy': 'same-origin',\n      'cross-origin-embedder-policy': 'require-corp',\n      'cross-origin-resource-policy': 'same-origin'\n",'')
fs.writeFileSync('mobile/static-server.mjs',s)
console.log('B mobile assets removed from build')
