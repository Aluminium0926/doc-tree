import http from 'node:http'
import puppeteer from 'puppeteer-core'
const bodies=[]
const srv=http.createServer((req,res)=>{
  res.setHeader('access-control-allow-origin','*')
  res.setHeader('access-control-allow-headers','*')
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  let b='';req.on('data',c=>b+=c);req.on('end',()=>{
    try{bodies.push(JSON.parse(b||'{}'))}catch{}
    res.writeHead(200,{'content-type':'text/event-stream'})
    res.write('data: {"choices":[{"delta":{"content":"看到图了"}}]}\n\n')
    res.end('data: [DONE]\n\n')
  })
})
await new Promise(r=>srv.listen(4427,'127.0.0.1',r))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage()
const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try{
  await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,700))
  const input=await p.$('#file-input')
  await input.uploadFile(process.env.APPDATA+'\\文档树\\files\\18e087b051a3.pdf')
  await new Promise(r=>setTimeout(r,3000))
  const docs=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();return j.docs.map(d=>({id:d.id,kind:d.kind,pages:d.pages?.length}))})
  const pdf=docs.find(d=>d.kind==='pdf')
  if(!pdf){console.log(JSON.stringify({docs,errs}));throw new Error('no pdf')}
  const shot=await p.evaluate(async(id)=>{const j=await (await fetch('/api/doc/'+id)).json();return j.doc.id},pdf.id)
  await p.evaluate(async(id)=>{const j=await (await fetch('/api/doc/'+id)).json();window.__doc=j.doc},pdf.id)
  // 通过 UI 打开文档，保证 S.pdf 已加载
  await p.goto('http://127.0.0.1:4501/?doc='+pdf.id,{waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,2500))
  const img=await p.evaluate(()=>window.__dtPageImage?.(1))
  await p.evaluate(async()=>{await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4427/v1',apiKey:'k',model:'text-model',visionModel:'vision-model',apiFormat:'openai',visionFormat:'auto'})})})
  const res=await p.evaluate(async(id)=>{
    const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:id,anchor:{kind:'doc',page:1,quote:''},question:'图里有什么'})})
    return await r.text()
  },pdf.id)
  await new Promise(r=>setTimeout(r,500))
  const cfgNow=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();return j.config})
  const body=bodies.find(x=>JSON.stringify(x.messages||'').includes('图里有什么')) || bodies[bodies.length-1]
  const content=body?.messages?.[1]?.content
  const hasImg=Array.isArray(content)&&content.some(c=>c.type==='image_url')
  console.log(JSON.stringify({ imgKB: img?Math.round(img.length/1024):0, bodies: bodies.length, model: body?.model, visionModel: cfgNow?.visionModel, roles: body?.messages?.map(m=>m.role), contentTypes: Array.isArray(body?.messages?.[1]?.content)?body.messages[1].content.map(c=>c.type):typeof body?.messages?.[1]?.content, hasImg, answer: res.includes('看到图了'), errs },null,1))
}finally{await b.close();srv.close()}
