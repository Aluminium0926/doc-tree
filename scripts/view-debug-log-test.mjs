import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage();p.on('console',m=>{const t=m.text();if(t.includes('[view]'))console.log(t)})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1000))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const pdfs=docs.filter(d=>d.kind==='pdf').slice(0,2)
async function click(t){await p.evaluate((t)=>{[...document.querySelectorAll('.doc-item')].find(x=>x.textContent.includes(t))?.click()},t);await new Promise(r=>setTimeout(r,2400))}
await click(pdfs[0].title)
await p.evaluate(()=>{const sc=document.querySelector('#page-scroll');sc.scrollTop=Math.round(sc.scrollHeight*0.35)});await new Promise(r=>setTimeout(r,600))
console.log('SET',await p.evaluate(()=>document.querySelector('#page-scroll').scrollTop))
await click(pdfs[1].title)
await click(pdfs[0].title)
console.log('FINAL',await p.evaluate(()=>document.querySelector('#page-scroll').scrollTop))
await b.close()
