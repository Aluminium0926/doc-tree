import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.31')
  const d=document.createElement('div');d.id='chemt'
  d.innerHTML='<pre><code class="language-reaction">label: 与苯胺偶合\nreaction: [N-]=[N+]-c1ccccc1.Nc1ccccc1>>Nc1ccc(N=Nc2ccccc2)cc1</code></pre><pre><code class="language-smiles">c1ccccc1</code></pre>'
  mod.enhanceChemBlocks(d) // detached
  window.__chemt=d
})
await new Promise(r=>setTimeout(r,1000))
await p.evaluate(()=>document.body.append(window.__chemt))
for(let i=0;i<30;i++){const st=await p.evaluate(()=>[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state));if(st.length&&st.every(x=>x==='done'||x==='error'))break;await new Promise(r=>setTimeout(r,500))}
const state=await p.evaluate(()=>({states:[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state),svgs:document.querySelectorAll('#chemt svg').length,html:document.querySelector('#chemt .chem-canvas')?.innerText.slice(0,100)}))
console.log(state,'errs',errs.slice(0,3))
await p.screenshot({path:'chem-detached.png',fullPage:true})
await b.close()
