import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:1000}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js')
  const d=document.createElement('div');d.id='chemt';document.body.append(d)
  d.innerHTML=`<pre><code class="language-reaction">label: 分字段反应
reactants: CC(=O)Cl.OCC
reagents: Et3N, DCM
products: CC(=O)OCC</code></pre>
<pre><code class="language-reaction">label: 错误示例
reactants: [N-]=[N+]-c1ccccc1,aniline[N-]=[N+]-c1ccccc1
products: CN(C)c1ccc(/N=N/c2ccccc2)cc1</code></pre>
<pre><code class="language-smiles">c1ccccc1</code></pre>`
  mod.enhanceChemBlocks(d)
})
for(let i=0;i<30;i++){const st=await p.evaluate(()=>[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state));if(st.length>=3&&st.every(x=>x==='done'||x==='error'))break;await new Promise(r=>setTimeout(r,500))}
const state=await p.evaluate(()=>({figs:[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state),sources:[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.source),caps:[...document.querySelectorAll('#chemt .chem-cap')].map(x=>x.innerText),rxnLine:[...document.querySelectorAll('#chemt .chem-rxn')].map(x=>({w:x.scrollWidth,c:x.clientWidth,h:x.querySelector('.chem-side')?.getBoundingClientRect().height}))}))
console.log(JSON.stringify(state,null,1));console.log('errs',errs.slice(0,3))
await p.screenshot({path:'chem-variants.png',fullPage:true})
await b.close()
