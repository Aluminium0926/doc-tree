import fs from 'node:fs'
import { convertDocument } from '@matbee/libreoffice-converter'
const buf=fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_and_Classification_EN.pptx')
const t0=Date.now()
const r=await convertDocument(new Uint8Array(buf),{outputFormat:'pdf'})
console.log(JSON.stringify({ms:Date.now()-t0, bytes:r.data.length, pages:r.pageCount||null, name:r.fileName||null}))
fs.writeFileSync('scripts/wasm-out.pdf',Buffer.from(r.data))
