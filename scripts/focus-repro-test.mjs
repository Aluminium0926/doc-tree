import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const d=docs.find(x=>x.id==='2eb2a5d8ece3')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),d.id);await new Promise(r=>setTimeout(r,2500))
// select text in a node question
const hits=await p.evaluate(()=>[...document.querySelectorAll('.node .node-q')].map(x=>x.textContent).slice(0,20))
console.log('questions',hits.slice(0,8))
await p.evaluate(()=>{
 const q=[...document.querySelectorAll('.node .node-q')].find(x=>x.textContent.includes('补全'))||document.querySelector('.node .node-q')
 if(!q) return
 const r=document.createRange();r.selectNodeContents(q)
 const s=getSelection();s.removeAllRanges();s.addRange(r)
})
await p.keyboard.down('Control');await p.keyboard.press('KeyC');await p.keyboard.up('Control')
// click a few times
for(let i=0;i<3;i++){await p.mouse.click(600,400);await new Promise(r=>setTimeout(r,200))}
await p.evaluate(()=>{const t=document.querySelector('#tree');t.scrollTop=t.scrollHeight})
await new Promise(r=>setTimeout(r,300))
const btns=await p.$$('[data-act="again"]');console.log('again buttons',btns.length)
if(btns.length){await btns[btns.length-1].click();await new Promise(r=>setTimeout(r,400))}
const res=await p.evaluate(()=>({active:document.activeElement?.id,tag:document.activeElement?.tagName,sel:window.getSelection()?.toString().slice(0,20),focused:document.hasFocus(),chip:!document.querySelector('#anchor-chip')?.hidden}))
console.log(res)
await p.screenshot({path:'focus-repro.png'})
await b.close()
