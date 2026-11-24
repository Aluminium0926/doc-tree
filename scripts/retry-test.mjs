import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
let hits = 0
const srv = http.createServer((req,res)=>{ req.resume(); req.on('end',()=>{
  hits++
  if (hits <= 2) { res.writeHead(500, {'content-type':'application/json'}); res.end('{"error":"boom"}'); return }
  res.writeHead(200, {'content-type':'text/event-stream'})
  res.write('data: {"choices":[{"delta":{"content":"重试成功"}}]}\n\n')
  res.end('data: [DONE]\n\n')
}) })
await new Promise(r=>srv.listen(4420,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4420/v1',apiKey:'k',model:'m',apiFormat:'openai'})
  const st = await (await fetch(base+'/api/state')).json()
  const doc = st.docs.find(d=>d.kind==='pdf')
  const before = await (await fetch(base+'/api/doc/'+doc.id)).json()
  const res = await (await post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'测试重试'})).text()
  await new Promise(r=>setTimeout(r,300))
  const after = await (await fetch(base+'/api/doc/'+doc.id)).json()
  const fresh = Object.values(after.tree.nodes).filter(n=>!before.tree.nodes[n.id])
  const last = fresh[fresh.length-1]
  console.log(JSON.stringify({ hits, answer: last?.answer, error: last?.error || null, sseOk: res.includes('重试成功') }))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
