import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage();let body=null
p.on('request',r=>{if(r.url().endsWith('/api/ask')&&r.method()==='POST'){body=r.postData()}})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,800))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const pdf=docs.find(d=>d.kind==='pdf')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),pdf.id)
await new Promise(r=>setTimeout(r,2500))
const page=await p.$('.page');if(page){await page.click({button:'right'});await new Promise(r=>setTimeout(r,300));await p.click('#pm-explain');await new Promise(r=>setTimeout(r,1200))}
console.log('hasImage',body?JSON.parse(body).image?true:false:null,'bodyLen',body?.length)
await b.close()
