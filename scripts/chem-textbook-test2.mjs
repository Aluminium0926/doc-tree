import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.37')
  const d=document.createElement('div');d.id='chemt'
  d.innerHTML='<pre><code class="language-reaction">label: N-甲基苯胺的重氮化\nreaction: CNc1ccccc1>>CN(c1ccccc1)N=O.O\nreagents: NaNO2\nconditions: HCl</code></pre>'
  mod.enhanceChemBlocks(d)
  window.__chemt=d
})
await new Promise(r=>setTimeout(r,700));await p.evaluate(()=>document.body.append(window.__chemt))
for(let i=0;i<20;i++){const st=await p.evaluate(()=>document.querySelector('#chemt .chem-figure')?.dataset.state);if(st==='done'||st==='error')break;await new Promise(r=>setTimeout(r,500))}
const state=await p.evaluate(()=>({state:document.querySelector('#chemt .chem-figure')?.dataset.state,above:document.querySelector('#chemt .chem-agents')?.textContent,below:document.querySelector('#chemt .chem-cond-arrow')?.textContent,svgs:document.querySelectorAll('#chemt svg').length}))
console.log(state,'errs',errs.slice(0,3))
await p.screenshot({path:'chem-textbook.png',fullPage:true})
await b.close()

