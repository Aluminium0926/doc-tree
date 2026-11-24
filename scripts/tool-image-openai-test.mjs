import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const bodies=[]
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  const j=JSON.parse(b||'{}'); bodies.push(j)
  res.writeHead(200,{'content-type':'text/event-stream'})
  const hasTool=(j.messages||[]).some(m=>m.role==='tool')
  if(!hasTool){
    res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_page","arguments":"{\\"page\\":47}"}}]}}]}\n\n')
    res.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n')
    res.end('data: [DONE]\n\n')
  } else {
    res.write('data: {"choices":[{"delta":{"content":"图看到了"}}]}\n\n')
    res.end('data: [DONE]\n\n')
  }
}) })
await new Promise(r=>srv.listen(4425,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4425/v1',apiKey:'k',model:'text-model',visionModel:'vision-model',apiFormat:'openai'})
  const st=await (await fetch(base+'/api/state')).json()
  const doc=st.docs.find(d=>d.kind==='pdf' && d.pages>=47)
  const res=await (await post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:47,quote:''},question:'图里有什么'})).text()
  await new Promise(r=>setTimeout(r,300))
  const second=bodies[1]
  const msgs=second?.messages||[]
  const toolMsg=msgs.find(m=>m.role==='tool')
  const userImg=msgs.find(m=>m.role==='user' && Array.isArray(m.content) && m.content.some(c=>c.type==='image_url'))
  console.log(JSON.stringify({
    model: second?.model,
    toolTextHasPage: (toolMsg?.content||'').includes('第47页'),
    imageMsg: !!userImg,
    imageKB: userImg ? Math.round(JSON.stringify(userImg).length/1024) : 0,
    answer: res.includes('图看到了')
  }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
