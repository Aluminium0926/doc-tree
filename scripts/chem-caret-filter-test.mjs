import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
// caret rescue
await p.evaluate(()=>document.activeElement?.blur())
await p.keyboard.type('abc')
const caret=await p.evaluate(()=>({active:document.activeElement?.id,val:document.querySelector('#q')?.value}))
console.log('caret',caret)
// reaction
await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.36')
  const d=document.createElement('div');d.id='chemt'
  d.innerHTML=`<pre><code class="language-reaction">label: 苯胺偶合
reaction: [Cl-].[N+]#Nc1ccccc1.Nc1ccccc1>>Nc1ccc(/N=N/c2ccccc2)cc1.Cl</code></pre>`
  mod.enhanceChemBlocks(d);window.__chemt=d
})
await new Promise(r=>setTimeout(r,600));await p.evaluate(()=>document.body.append(window.__chemt))
for(let i=0;i<20;i++){const st=await p.evaluate(()=>document.querySelector('#chemt .chem-figure')?.dataset.state);if(st==='done'||st==='error'||st==='partial')break;await new Promise(r=>setTimeout(r,400))}
const state=await p.evaluate(()=>({state:document.querySelector('#chemt .chem-figure')?.dataset.state,parts:[...document.querySelectorAll('#chemt .chem-part')].map(x=>x.textContent.trim().slice(0,20)),svgs:document.querySelectorAll('#chemt svg').length,src:document.querySelector('#chemt .chem-figure')?.dataset.source}))
console.log(state,'errs',errs.slice(0,3))
await p.screenshot({path:'chem-filter.png',fullPage:true})
await b.close()
