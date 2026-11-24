import fs from 'node:fs'
const F='scripts/tool-image-anthropic-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("console.log(JSON.stringify({ requests: bodies.length,", "console.log(JSON.stringify({ path: '/v1/messages', req0: { model: bodies[0]?.model, sysIsArray: Array.isArray(bodies[0]?.system), tools: bodies[0]?.tools?.length, role0: bodies[0]?.messages?.[0]?.role, content0Type: typeof bodies[0]?.messages?.[0]?.content }, requests: bodies.length,")
fs.writeFileSync(F,t)
console.log('more debug')
