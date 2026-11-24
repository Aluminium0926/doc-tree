import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("const converter = new WorkerBrowserConverter({", "const converter = new BrowserConverter({")
s=s.replace("    browserWorkerJs: '/node_modules/@matbee/libreoffice-converter/dist/browser.worker.global.js',\n", "")
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('browser converter?', s.includes('new BrowserConverter'))
