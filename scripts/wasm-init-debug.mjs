import { createSubprocessConverter } from '@matbee/libreoffice-converter'
try {
  const c=await createSubprocessConverter({wasmPath:'C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/wasm',verbose:true,includeSystemFonts:true})
  console.log('init ok')
  await c.destroy()
} catch(e){ console.error('ERR', e.message, e.stack) }
