import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.36')
  const d=document.createElement('div');d.id='chemt'
  d.innerHTML=`<pre><code class="language-reaction">label: 酚偶合
reaction: [Cl-].[N+]#Nc1ccccc1.Oc1ccccc1>>Occc(/N=N/c2ccccc2)cc1.Cl</code></pre>
<pre><code class="language-reaction">label: 苯胺偶合
reaction: [Cl-].[N+]#Nc1ccccc1.Nc1ccccc1>>Nc1ccc(/N=N/c2ccccc2)cc1.Cl</code></pre>`
  mod.enhanceChemBlocks(d);window.__chemt=d
})
await new Promise(r=>setTimeout(r,600));await p.evaluate(()=>document.body.append(window.__chemt))
for(let i=0;i<30;i++){const st=await p.evaluate(()=>[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state));if(st.length&&st.every(x=>x==='done'||x==='error'||x==='partial'))break;await new Promise(r=>setTimeout(r,500))}
const state=await p.evaluate(()=>({states:[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state),bad:[...document.querySelectorAll('#chemt .chem-part-error')].length,svgs:document.querySelectorAll('#chemt svg').length,src:[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.source)}))
console.log(JSON.stringify(state,null,1));console.log('errs',errs.slice(0,3))
await p.screenshot({path:'chem-diazo.png',fullPage:true})
await b.close()
