import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage()
p.on('dialog',async d=>await d.accept())
const asks=[]
await p.setRequestInterception(true)
p.on('request',r=>{if(r.url().endsWith('/api/ask')){asks.push(r.postData());r.abort()}else r.continue()})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const d=docs.find(x=>x.id==='2eb2a5d8ece3')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),d.id);await new Promise(r=>setTimeout(r,2200))
// delete last
const dels=await p.$$('[data-act="del"]');await dels[dels.length-1].click();await new Promise(r=>setTimeout(r,900))
const again=await p.$$('[data-act="again"]')
async function follow(i,text){
 await again[i].click();await new Promise(r=>setTimeout(r,150))
 await p.type('#q',text)
 await p.click('#btn-send');await new Promise(r=>setTimeout(r,300))
}
await follow(0,'test one')
await follow(again.length-1,'test two')
console.log('asks',asks.map(x=>{try{const j=JSON.parse(x);return {parent:j.parentId,anchor:j.anchor?.nodeId,q:j.question}}catch{return x}}))
await b.close()
