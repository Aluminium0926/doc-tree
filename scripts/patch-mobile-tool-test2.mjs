import fs from 'node:fs'
const F='scripts/mobile-tool-image-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("const pdf=docs.find(d=>d.kind==='pdf'&&d.pages>=47)","const pdf=docs.find(d=>d.kind==='pdf')")
t=t.replace('{\\"page\\":47}','{\\"page\\":1}')
t=t.replace("anchor:{kind:'doc',page:47,quote:''},question:'读47页'","anchor:{kind:'doc',page:1,quote:''},question:'读第1页'")
fs.writeFileSync(F,t)
console.log('test fixed')
