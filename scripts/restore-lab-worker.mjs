import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("const converter = new BrowserConverter({", "const converter = new WorkerBrowserConverter({")
if(!s.includes('browserWorkerJs')){
  s=s.replace("    ...createWasmPaths('/wasm/'),\n", "    ...createWasmPaths('/wasm/'),\n    browserWorkerJs: '/node_modules/@matbee/libreoffice-converter/dist/browser.worker.global.js',\n")
}
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('worker restored', s.includes('browserWorkerJs'))
