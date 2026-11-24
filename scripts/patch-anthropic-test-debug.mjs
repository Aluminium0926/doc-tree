import fs from 'node:fs'
const F='scripts/tool-image-anthropic-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("console.log(JSON.stringify({ model: bodies[1]?.model, roles: msgs.map(m=>m.role).slice(-3), toolResultImage: !!hasImg, answer: res.includes('看到了') }, null, 1))", "console.log(JSON.stringify({ requests: bodies.length, lastRoles: (bodies[bodies.length-1]?.messages||[]).map(m=>m.role).slice(-4), toolResultImage: !!hasImg, answer: res.includes('看到了'), tail: res.slice(-300) }, null, 1))")
fs.writeFileSync(F,t)
console.log('debug updated')
