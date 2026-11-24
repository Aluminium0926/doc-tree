import fs from 'node:fs'
const F='scripts/mobile-tool-image-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("  await new Promise(r=>setTimeout(r,600))\n  const docs=", "  await new Promise(r=>setTimeout(r,600))\n  const input=await p.$('#file-input')\n  await input.uploadFile(process.env.APPDATA+'\\\\文档树\\\\files\\\\18e087b051a3.pdf')\n  await new Promise(r=>setTimeout(r,3500))\n  const docs=")
fs.writeFileSync(F,t)
console.log('import added')
