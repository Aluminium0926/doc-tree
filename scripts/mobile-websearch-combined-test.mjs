import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,180))})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate((cfg)=>{localStorage.setItem('dt:seenWelcome','1');localStorage.setItem('dt:config',JSON.stringify({baseUrl:cfg.baseUrl,apiKey:cfg.apiKey,model:cfg.model,apiFormat:cfg.apiFormat,visionModel:cfg.visionModel,visionBaseUrl:cfg.visionBaseUrl,visionApiKey:cfg.visionApiKey,visionFormat:cfg.visionFormat,temperature:cfg.temperature}))},cfg)
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,700))
await (await p.$('#file-input')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/data/files/2eb2a5d8ece3.pdf');await new Promise(r=>setTimeout(r,2500))
const result=await p.evaluate(async()=>{
  const st=await (await fetch('/api/state')).json();const doc=st.docs[0]
  const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'先读一下这一页，再联网搜索 2026 年 11 月 24 日北京天气，一起回答并给来源',web:true})})
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='',answer='',tools=[],sources=[]
  while(true){const {value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n\n'))>=0){const raw=buf.slice(0,i);buf=buf.slice(i+2);if(!raw.startsWith('data: '))continue;let j;try{j=JSON.parse(raw.slice(6))}catch{continue};if(j.type==='delta')answer+=j.text;if(j.type==='tool')tools.push(j.name);if(j.type==='web-sources')sources=j.sources;if(j.type==='error')answer+='[ERR]'+j.message}}
  return {tools,sources:sources?.length,tail:answer.slice(-300)}
})
console.log(JSON.stringify(result,null,1));console.log('errs',errs.slice(0,4))
await b.close()
