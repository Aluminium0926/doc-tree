import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const bodies = []
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  const j = JSON.parse(b||'{}'); bodies.push(j)
  res.writeHead(200, {'content-type':'text/event-stream'})
  const hasResult = JSON.stringify(j.messages||'').includes('tool_result')
  const send = (o)=>res.write('data: '+JSON.stringify(o)+'\n\n')
  if (!hasResult) {
    send({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'t1',name:'read_page'}})
    send({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"page":42}'}})
    send({type:'message_stop'})
  } else {
    send({type:'content_block_delta',index:0,delta:{type:'text_delta',text:'ok'}})
    send({type:'message_stop'})
  }
  res.end()
}) })
await new Promise(r=>srv.listen(4416,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4416/v1',apiKey:'k',model:'m',apiFormat:'anthropic'})
  const st = await (await fetch(base+'/api/state')).json()
  const doc = st.docs.find(d=>d.kind==='pdf' && d.pages>=42)
  await post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'讲第42页'})
  await new Promise(r=>setTimeout(r,300))
  const b0 = bodies[0]
  const sys = b0.system
  const tools = b0.tools || []
  const user = (b0.messages||[]).find(m=>m.role==='user')
  const blocks = Array.isArray(user?.content) ? user.content : []
  console.log(JSON.stringify({
    systemIsArray: Array.isArray(sys),
    systemCached: Array.isArray(sys) && sys[0]?.cache_control?.type === 'ephemeral',
    toolsCached: tools.length > 0 && tools[tools.length-1]?.cache_control?.type === 'ephemeral',
    userBlocks: blocks.length,
    stableCached: blocks[0]?.cache_control?.type === 'ephemeral',
    volatileNoCache: blocks[1] && !blocks[1].cache_control
  }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
