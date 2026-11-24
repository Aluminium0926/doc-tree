import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,180))})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js')
  const d=document.createElement('div');d.id='chemt';document.body.append(d)
  d.innerHTML='<pre><code class="language-smiles">c1ccccc1</code></pre><pre><code class="language-reaction">label: 酯化\nreaction: CC(=O)Cl.OCC>>CC(=O)OCC\nconditions: Et3N, DCM</code></pre>'
  mod.enhanceChemBlocks(d)
})
for(let i=0;i<40;i++){const n=await p.evaluate(()=>document.querySelectorAll('#chemt svg').length);if(n>=4)break;await new Promise(r=>setTimeout(r,500))}
const state=await p.evaluate(()=>({figs:document.querySelectorAll('#chemt .chem-figure').length,svgs:document.querySelectorAll('#chemt svg').length,states:[...document.querySelectorAll('#chemt .chem-figure')].map(x=>x.dataset.state)}))
console.log(state,'errs',errs.slice(0,3))
await p.screenshot({path:'chem-mobile.png',fullPage:true})
await b.close()
