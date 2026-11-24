import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("import { WorkerBrowserConverter, createWasmPaths } from", "import { WorkerBrowserConverter, BrowserConverter, createWasmPaths } from")
s=s.replace(
`  const c = new WorkerBrowserConverter({
    ...createWasmPaths(BASE + 'wasm/'),
    browserWorkerJs: BASE + 'browser.worker.global.js',`,
`  const c = new BrowserConverter({
    ...createWasmPaths(BASE + 'wasm/'),`
)
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('lab uses BrowserConverter', s.includes('new BrowserConverter'))
