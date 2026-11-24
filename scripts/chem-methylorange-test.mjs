import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:1000}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.39')
  const d=document.createElement('div');d.id='chemt'
  d.innerHTML='<pre><code class="language-reaction">label: 甲基橙\nreaction: [O-]S(=O)(=O)c1ccc([N+]#N)cc1.CN(C)c1ccccc1>>CN(C)c1ccc(/N=N/c2ccc(S(=O)(=O)[O-])cc2)cc1\nreagents: 无</code></pre>'
  mod.enhanceChemBlocks(d);window.__chemt=d
})
await new Promise(r=>setTimeout(r,600));await p.evaluate(()=>document.body.append(window.__chemt))
for(let i=0;i<25;i++){const st=await p.evaluate(()=>document.querySelector('#chemt .chem-figure')?.dataset.state);if(st==='done'||st==='error'||st==='partial')break;await new Promise(r=>setTimeout(r,400))}
const state=await p.evaluate(()=>{
 const cy=(el)=>el?el.getBoundingClientRect().top+el.getBoundingClientRect().height/2:null
 return {state:document.querySelector('#chemt .chem-figure')?.dataset.state, plus:cy(document.querySelector('#chemt .chem-plus')), arrow:cy(document.querySelector('#chemt .chem-arrow-line')), svgs:document.querySelectorAll('#chemt svg').length}
})
console.log(state,'errs',errs.slice(0,3))
await p.screenshot({path:'chem-methylorange.png',fullPage:true})
await b.close()
