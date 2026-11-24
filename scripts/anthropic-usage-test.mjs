import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req,res)=>{ req.resume(); req.on('end',()=>{
  res.writeHead(200,{'content-type':'text/event-stream'})
  const send=(o)=>res.write('data: '+JSON.stringify(o)+'\n\n')
  send({type:'message_start',message:{usage:{input_tokens:1500,cache_read_input_tokens:1000,cache_creation_input_tokens:400}}})
  send({type:'content_block_delta',index:0,delta:{type:'text_delta',text:'你好'}})
  send({type:'message_delta',usage:{output_tokens:120}})
  send({type:'message_stop'})
  res.end()
}) })
await new Promise(r=>srv.listen(4419,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4419/v1',apiKey:'k',model:'m',apiFormat:'anthropic'})
  const st = await (await fetch(base+'/api/state')).json()
  const doc = st.docs.find(d=>d.kind==='pdf')
  const r = await (await post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'在吗'})).text()
  await new Promise(r=>setTimeout(r,300))
  const d = await (await fetch(base+'/api/doc/'+doc.id)).json()
  const nodes = Object.values(d.tree.nodes).sort((a,b)=>a.createdAt-b.createdAt)
  console.log(JSON.stringify({ usage: nodes[nodes.length-1]?.usage, sseHasUsage: r.includes('"usage"') }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
