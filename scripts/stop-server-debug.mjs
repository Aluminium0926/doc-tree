import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  const j = JSON.parse(b||'{}'); res.writeHead(200,{'content-type':'text/event-stream'})
  const hasTool=(j.messages||[]).some(m=>m.role==='tool')
  if(!hasTool){res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_page","arguments":"{\\"page\\":42}"}}]}}]}\n\n');res.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n');res.end('data: [DONE]\n\n')}
  else { let n=0; const t=setInterval(()=>{res.write('data: '+JSON.stringify({choices:[{delta:{content:'片段'+n}}]})+'\n\n');n++;if(n>50){clearInterval(t);res.end('data: [DONE]\n\n')}},120); req.on('close',()=>clearInterval(t)) }
}) })
await new Promise(r=>srv.listen(4422,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4422/v1',apiKey:'k',model:'m',apiFormat:'openai'})
  const st=await (await fetch(base+'/api/state')).json()
  const doc=st.docs.find(d=>d.kind==='pdf' && d.pages>=42)
  const before=await (await fetch(base+'/api/doc/'+doc.id)).json()
  const ac=new AbortController()
  const req=post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'中断测试'}).then(r=>r.text()).catch(()=>null)
  await new Promise(r=>setTimeout(r,1500))
  ac.abort()
  // 不等待请求；客户端 abort 不直接关闭 fetch？ 这里用 AbortController 需传给 fetch
  await new Promise(r=>setTimeout(r,800))
  const after=await (await fetch(base+'/api/doc/'+doc.id)).json()
  const fresh=Object.values(after.tree.nodes).filter(n=>!before.tree.nodes[n.id])
  console.log(JSON.stringify({ fresh: fresh.map(n=>({stopped:n.stopped, error:n.error||null, len:(n.answer||'').length, status:n.status||null})) }))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
