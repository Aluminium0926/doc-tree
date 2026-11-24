import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const d=docs.find(x=>x.id==='2eb2a5d8ece3')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),d.id);await new Promise(r=>setTimeout(r,2200))
// select text inside an answer, dispatch mouseup
const before=await p.evaluate(()=>{
 const ans=document.querySelector('.node .answer')
 const r=document.createRange();r.selectNodeContents(ans.querySelector('p')||ans)
 const s=getSelection();s.removeAllRanges();s.addRange(r)
 ans.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}))
 return {chipHidden:document.querySelector('#anchor-chip')?.hidden,float:!document.querySelector('#float-menu')?.hidden}
})
await new Promise(r=>setTimeout(r,150))
const afterSel=await p.evaluate(()=>({chipHidden:document.querySelector('#anchor-chip')?.hidden,chip:document.querySelector('#anchor-chip')?.innerText,float:!document.querySelector('#float-menu')?.hidden,armed:document.querySelectorAll('.node.armed').length}))
if(await p.$('#float-menu button')){await p.click('#float-menu button');await new Promise(r=>setTimeout(r,150))}
const afterClick=await p.evaluate(()=>({chip:document.querySelector('#anchor-chip')?.innerText,armed:document.querySelectorAll('.node.armed').length,active:document.activeElement?.id}))
// empty chem block skip
await p.evaluate(async()=>{const mod=await import('/chem.js?v=1.0.44');const d=document.createElement('div');d.id='emptychem';d.innerHTML='<pre><code class="language-smiles">label: 对羟基偶氮苯\nconditions: pH 7-10</code></pre>';document.body.append(d);mod.enhanceChemBlocks(d)})
await new Promise(r=>setTimeout(r,300))
const empty=await p.evaluate(()=>({figs:document.querySelectorAll('#emptychem .chem-figure').length,pre:document.querySelectorAll('#emptychem pre').length}))
console.log({before,afterSel,afterClick,empty})
await b.close()
