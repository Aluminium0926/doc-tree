import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage();p.on('dialog',async d=>await d.accept())
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const d=docs.find(x=>x.id==='2eb2a5d8ece3')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),d.id);await new Promise(r=>setTimeout(r,2200))
const dels=await p.$$('[data-act="del"]');await dels[dels.length-1].click();await new Promise(r=>setTimeout(r,900))
const again=await p.$$('[data-act="again"]')
async function click(i){await again[i].click();await new Promise(r=>setTimeout(r,200));return await p.evaluate(()=>({chip:document.querySelector('#anchor-chip')?.innerText,armed:[...document.querySelectorAll('.node.armed')].map(x=>x.dataset.id),active:document.activeElement?.id}))}
console.log('a',await click(0))
console.log('b',await click(again.length-1))
console.log('c',await click(0))
await b.close()
