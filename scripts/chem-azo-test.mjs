import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:900,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.31')
  const d=document.createElement('div');d.id='chemt';document.body.append(d)
  d.innerHTML='<pre><code class="language-reaction">label: 与苯胺偶合\nreaction: [N-]=[N+]-c1ccccc1.Nc1ccccc1>>Nc1ccc(N=Nc2ccccc2)cc1</code></pre>'
  mod.enhanceChemBlocks(d)
})
const t0=Date.now()
for(let i=0;i<40;i++){
  const st=await p.evaluate(()=>({state:document.querySelector('#chemt .chem-figure')?.dataset.state,html:document.querySelector('#chemt .chem-canvas')?.innerText.slice(0,80)}))
  console.log((Date.now()-t0)+'ms',st)
  if(st.state==='done'||st.state==='error')break
  await new Promise(r=>setTimeout(r,1000))
}
console.log('errs',errs.slice(0,5))
await b.close()
