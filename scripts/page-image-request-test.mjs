import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
let captured = null
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  captured = JSON.parse(b||'{}')
  res.writeHead(200,{'content-type':'text/event-stream'})
  res.write('data: {"choices":[{"delta":{"content":"看到了图"}}]}\n\n')
  res.end('data: [DONE]\n\n')
}) })
await new Promise(r=>srv.listen(4424,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4424/v1',apiKey:'k',model:'text-model',visionModel:'vision-model',apiFormat:'openai'})
  const st=await (await fetch(base+'/api/state')).json()
  const doc=st.docs.find(d=>d.file && d.kind==='pdf' && d.pages>=47) || st.docs.find(d=>d.kind==='pdf' && d.pages>=47)
  const t0=Date.now()
  const res=await (await post('/api/ask',{docId:doc.id,anchor:{kind:'doc',page:47,quote:''},question:'图里有什么'})).text()
  const dt=Date.now()-t0
  const content=captured?.messages?.[1]?.content
  const img=Array.isArray(content) ? content.find(c=>c.type==='image_url') : null
  console.log(JSON.stringify({
    model: captured?.model,
    hasCaption: Array.isArray(content) && content.some(c=>c.type==='text' && c.text.includes('截图')),
    imgPrefix: img?.image_url?.url?.slice(0,30),
    imgKB: img ? Math.round(img.image_url.url.length/1024) : 0,
    ms: dt,
    answer: res.includes('看到了图')
  }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); srv.close() }
