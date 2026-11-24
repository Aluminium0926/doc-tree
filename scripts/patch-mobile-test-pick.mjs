import fs from 'node:fs'
const F='scripts/mobile-page-image-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("  const body=bodies[0]", "  const body=bodies.find(x=>JSON.stringify(x.messages||'').includes('图里有什么')) || bodies[bodies.length-1]")
fs.writeFileSync(F,t)
console.log('pick ask body')
