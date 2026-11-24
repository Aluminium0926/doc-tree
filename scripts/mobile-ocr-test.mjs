import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const cfg=JSON.parse(fs.readFileSync(process.env.APPDATA+'/文档树/config.json','utf8'))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150))})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate((cfg)=>{localStorage.setItem('dt:seenWelcome','1');localStorage.setItem('dt:config',JSON.stringify({baseUrl:cfg.baseUrl,apiKey:cfg.apiKey,model:cfg.model,apiFormat:cfg.apiFormat,visionModel:cfg.visionModel,visionBaseUrl:cfg.visionBaseUrl,visionApiKey:cfg.visionApiKey,visionFormat:cfg.visionFormat,temperature:cfg.temperature}))},cfg)
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,700))
await (await p.$('#file-input')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/doc-tree/scripts/lab-A-page1.png')
await new Promise(r=>setTimeout(r,9000))
const st=await p.evaluate(async()=>{const s=await (await fetch('/api/state')).json();const d=s.docs.find(x=>x.kind==='image');const det=d?await (await fetch('/api/doc/'+d.id)).json():null;return {doc:d&&{title:d.title,kind:d.kind},text:(det?.doc?.pages?.[0]?.text||'').slice(0,180),len:(det?.doc?.pages?.[0]?.text||'').length,ocr:det?.doc?.ocr,status:document.querySelector('#status')?.textContent||''}})
console.log(JSON.stringify(st,null,1));console.log('errs',errs.slice(0,3))
await b.close()
