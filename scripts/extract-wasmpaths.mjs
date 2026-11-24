import fs from 'node:fs'
const t=fs.readFileSync('node_modules/@matbee/libreoffice-converter/dist/browser.js','utf8')
const i=t.indexOf('function createWasmPaths')
console.log(t.slice(i,i+800))
