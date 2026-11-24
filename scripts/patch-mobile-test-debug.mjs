import fs from 'node:fs'
const F='scripts/mobile-page-image-test.mjs'
let t=fs.readFileSync(F,'utf8')
t=t.replace("  const body=bodies[0]", "  const cfgNow=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();return j.config})\n  const body=bodies[0]")
t=t.replace("  console.log(JSON.stringify({ imgPrefix: img?.slice(0,30), imgKB: img?Math.round(img.length/1024):0, model: body?.model, hasImg, answer: res.includes('看到图了'), errs },null,1))", "  console.log(JSON.stringify({ imgKB: img?Math.round(img.length/1024):0, bodies: bodies.length, model: body?.model, visionModel: cfgNow?.visionModel, roles: body?.messages?.map(m=>m.role), contentTypes: Array.isArray(body?.messages?.[1]?.content)?body.messages[1].content.map(c=>c.type):typeof body?.messages?.[1]?.content, hasImg, answer: res.includes('看到图了'), errs },null,1))")
fs.writeFileSync(F,t)
console.log('debug test updated')
