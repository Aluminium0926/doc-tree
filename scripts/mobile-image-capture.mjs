import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844}})
const p=await b.newPage()
p.on('request',r=>{if(r.method()==='POST'&&r.url().includes('deepseek.com')){const d=r.postData()||'';try{const j=JSON.parse(d);const u=j.messages?.[1]?.content?.[1]?.image_url?.url||'';console.log('image url len',u.length,'head',u.slice(0,50),'tail',u.slice(-30))}catch(e){console.log('parse err',e.message)}}})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate((cfg)=>{localStorage.setItem('dt:seenWelcome','1');localStorage.setItem('dt:config',JSON.stringify({baseUrl:cfg.baseUrl,apiKey:cfg.apiKey,model:cfg.model,apiFormat:cfg.apiFormat,visionModel:cfg.visionModel,visionBaseUrl:cfg.visionBaseUrl,visionApiKey:cfg.visionApiKey,visionFormat:cfg.visionFormat,temperature:cfg.temperature}))},cfg)
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,700))
await (await p.$('#file-input')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/scripts/lab-A-page1.png');await new Promise(r=>setTimeout(r,3000))
await p.evaluate(async()=>{const s=await (await fetch('/api/state')).json();const d=s.docs.find(x=>x.kind==='image');await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docId:d.id,anchor:{kind:'doc',page:1,quote:''},question:'图里有什么？一句话'})}).then(r=>r.text())})
await new Promise(r=>setTimeout(r,3000))
await b.close()
