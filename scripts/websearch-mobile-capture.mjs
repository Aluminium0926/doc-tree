import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844}})
const p=await b.newPage()
p.on('request',r=>{if(r.method()==='POST'&&(r.url().includes('/proxy/llm')||r.url().includes('deepseek.com'))){const d=r.postData()||'';console.log('REQ',r.url(),'web?',d.includes('deepseek_web_search'),'tools?',d.includes('"tools"'),'bodyHead',d.slice(0,160))}})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate((cfg)=>{localStorage.setItem('dt:seenWelcome','1');localStorage.setItem('dt:config',JSON.stringify({baseUrl:cfg.baseUrl,apiKey:cfg.apiKey,model:cfg.model,apiFormat:cfg.apiFormat,visionModel:cfg.visionModel,visionBaseUrl:cfg.visionBaseUrl,visionApiKey:cfg.visionApiKey,visionFormat:cfg.visionFormat,temperature:cfg.temperature}))},cfg)
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,700))
await (await p.$('#file-input')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/data/files/2eb2a5d8ece3.pdf');await new Promise(r=>setTimeout(r,2200))
await p.evaluate(async()=>{const st=await (await fetch('/api/state')).json();const doc=st.docs[0];await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:doc.id,anchor:{kind:'doc',page:1,quote:''},question:'请联网搜索今天北京的天气，并给出来源',web:true})}).then(r=>r.text())})
await new Promise(r=>setTimeout(r,500))
await b.close()
