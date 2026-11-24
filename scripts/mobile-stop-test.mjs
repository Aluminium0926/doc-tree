import http from 'node:http'
import puppeteer from 'puppeteer-core'
const srv=http.createServer((req,res)=>{
  res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','*')
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  req.resume();req.on('end',()=>{
    res.writeHead(200,{'content-type':'text/event-stream'})
    let n=0;const t=setInterval(()=>{res.write('data: '+JSON.stringify({choices:[{delta:{content:'片段'+n}}]})+'\n\n');n++;if(n>100){clearInterval(t);res.end('data: [DONE]\n\n')}},120)
    req.on('close',()=>clearInterval(t))
  })
})
await new Promise(r=>srv.listen(4429,'127.0.0.1',r))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try{
  await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await p.$('#file-input').then(i=>i.uploadFile(process.env.APPDATA+'\\文档树\\files\\18e087b051a3.pdf'))
  await new Promise(r=>setTimeout(r,3000))
  const docs=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();return j.docs.map(d=>({id:d.id,kind:d.kind}))})
  const pdf=docs.find(d=>d.kind==='pdf')
  await p.evaluate(async()=>{await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4429/v1',apiKey:'k',model:'text-model',visionModel:'vision-model',apiFormat:'openai'})})})
  const result=await p.evaluate(async(id)=>{
    const ac=new AbortController()
    const req=fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:id,anchor:{kind:'doc',page:1,quote:''},question:'中断测试'}),signal:ac.signal}).then(r=>r.text()).catch(e=>'ABORT:'+e.name)
    await new Promise(r=>setTimeout(r,1500))
    ac.abort()
    const ab=await req
    await new Promise(r=>setTimeout(r,800))
    const d=await (await fetch('/api/doc/'+id)).json()
    const nodes=Object.values(d.tree.nodes).sort((a,b)=>a.createdAt-b.createdAt)
    const last=nodes[nodes.length-1]
    return { ab, stopped:!!last?.stopped, error:last?.error||null, len:(last?.answer||'').length }
  },pdf.id)
  console.log(JSON.stringify({...result,errs},null,1))
}finally{await b.close();srv.close()}
