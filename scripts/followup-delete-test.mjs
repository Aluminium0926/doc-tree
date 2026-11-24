import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage()
p.on('dialog',async d=>{console.log('DIALOG',d.message());await d.accept()})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const d=docs.find(x=>x.id==='2eb2a5d8ece3')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),d.id);await new Promise(r=>setTimeout(r,2500))
async function chip(){return await p.evaluate(()=>document.querySelector('#anchor-chip')?.hidden?null:document.querySelector('#anchor-chip')?.innerText)}
let again=await p.$$('[data-act="again"]');console.log('start nodes',again.length,'chip',await chip())
// delete last node
const dels=await p.$$('[data-act="del"]');console.log('dels',dels.length)
if(dels.length){await dels[dels.length-1].click();await new Promise(r=>setTimeout(r,1200))}
again=await p.$$('[data-act="again"]');console.log('after delete nodes',again.length,'chip',await chip())
if(again.length){
 await again[0].click();await new Promise(r=>setTimeout(r,300));console.log('first click chip',await chip())
 await again[again.length-1].click();await new Promise(r=>setTimeout(r,300));console.log('second click chip',await chip())
 await again[0].click();await new Promise(r=>setTimeout(r,300));console.log('third click chip',await chip())
}
console.log('active',await p.evaluate(()=>document.activeElement?.id))
await b.close()
