import http from 'node:http'
import puppeteer from 'puppeteer-core'
const bodies=[]
const srv=http.createServer((req,res)=>{
  res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*')
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  let b='';req.on('data',c=>b+=c);req.on('end',()=>{
    const j=JSON.parse(b||'{}');bodies.push(j)
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
  })
})
await new Promise(r=>srv.listen(4428,'127.0.0.1',r))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try{
  await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,600))
  const input=await p.$('#file-input')
  await input.uploadFile(process.env.APPDATA+'\\文档树\\files\\18e087b051a3.pdf')
  await new Promise(r=>setTimeout(r,3500))
  const docs=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();return j.docs.map(d=>({id:d.id,kind:d.kind,pages:d.pages?.length}))})
  const pdf=docs.find(d=>d.kind==='pdf')
  if(!pdf){console.log('no pdf',docs);throw new Error('no pdf')}
  await p.goto('http://127.0.0.1:4501/?doc='+pdf.id,{waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,2000))
  await p.evaluate(async()=>{await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4428/v1',apiKey:'k',model:'text-model',visionModel:'vision-model',apiFormat:'openai',visionFormat:'auto'})})})
  const res=await p.evaluate(async(id)=>{const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:id,anchor:{kind:'doc',page:1,quote:''},question:'读第1页'})});return await r.text()},pdf.id)
  await new Promise(r=>setTimeout(r,600))
  const second=bodies[bodies.length-1]
  const msgs=second?.messages||[]
  const userImg=msgs.find(m=>m.role==='user'&&Array.isArray(m.content)&&m.content.some(c=>c.type==='image_url'))
  console.log(JSON.stringify({ requests:bodies.length, roles:msgs.map(m=>m.role).slice(-3), hasToolImg:!!userImg, imgKB:userImg?Math.round(JSON.stringify(userImg).length/1024):0, answer:res.includes('图看到了'), errs },null,1))
}finally{await b.close();srv.close()}
