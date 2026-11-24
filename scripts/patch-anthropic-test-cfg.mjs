import fs from 'node:fs'
const F='scripts/tool-image-anthropic-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("  const st=await (await fetch(base+'/api/state')).json()", "  const st=await (await fetch(base+'/api/state')).json()\n  console.log('CFG', JSON.stringify({ apiFormat: st.config?.apiFormat, visionFormat: st.config?.visionFormat, visionModel: st.config?.visionModel }))")
fs.writeFileSync(F,t)
console.log('cfg print')
