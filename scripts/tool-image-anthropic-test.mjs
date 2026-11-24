import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const bodies=[]
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  const j=JSON.parse(b||'{}'); bodies.push(j)
  res.writeHead(200,{'content-type':'text/event-stream'})
  const hasImg=(j.messages||[]).some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='tool_result' && Array.isArray(c.content)))
  const send=(o)=>res.write('data: '+JSON.stringify(o)+'\n\n')
  if(!hasImg){
    send({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'t1',name:'read_page'}})
    send({type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"page":47}'}})
    send({type:'message_stop'})
  } else {
    send({type:'content_block_delta',index:0,delta:{type:'text_delta',text:'看到了'}})
    send({type:'message_stop'})
  }
  res.end()
}) })
await new Promise(r=>srv.listen(4426,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4426/v1',apiKey:'k',model:'text-model',visionModel:'vision-model',apiFormat:'anthropic'})
  const st=await (await fetch(base+'/api/state')).json()
  console.log('CFG', JSON.stringify({ apiFormat: st.config?.apiFormat, visionFormat: st.config?.visionFormat, visionModel: st.config?.visionModel }))
  const doc=st.docs.find(d=>d.kind==='pdf' && d.pages>=47)
  const res=await (await post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:47,quote:''},question:'图里有什么'})).text()
  await new Promise(r=>setTimeout(r,300))
  const msgs=bodies[1]?.messages||[]
  const userBlock=msgs.find(m=>m.role==='user'&&Array.isArray(m.content)&&m.content.some(c=>c.type==='tool_result'))
  const tr=userBlock?.content.find(c=>c.type==='tool_result')
  const hasImg=Array.isArray(tr?.content)&&tr.content.some(c=>c.type==='image')
  console.log(JSON.stringify({ path: '/v1/messages', req0: { model: bodies[0]?.model, sysIsArray: Array.isArray(bodies[0]?.system), tools: bodies[0]?.tools?.length, role0: bodies[0]?.messages?.[0]?.role, content0Type: typeof bodies[0]?.messages?.[0]?.content }, requests: bodies.length, lastRoles: (bodies[bodies.length-1]?.messages||[]).map(m=>m.role).slice(-4), toolResultImage: !!hasImg, answer: res.includes('看到了'), tail: res.slice(-300) }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
