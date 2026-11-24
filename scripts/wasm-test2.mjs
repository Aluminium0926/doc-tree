import fs from 'node:fs'
import { createSubprocessConverter } from '@matbee/libreoffice-converter'
try{
  const c=await createSubprocessConverter({wasmPath:'C:/dt-wasm',verbose:true})
  console.log('init ok')
  const buf=fs.readFileSync('C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_and_Classification_EN.pptx')
  const t0=Date.now()
  const r=await c.convert(new Uint8Array(buf),{outputFormat:'pdf'})
  console.log('converted',Date.now()-t0,'ms',r.data.length,'bytes')
  fs.writeFileSync('scripts/wasm-out.pdf',Buffer.from(r.data))
  await c.destroy()
}catch(e){console.error('ERR',e.message)}
