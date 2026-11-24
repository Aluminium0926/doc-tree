import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,900))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs);const pdf=docs.find(d=>d.kind==='pdf')
await p.evaluate((id)=>document.querySelector(`.doc-item[data-id="${id}"]`)?.click(),pdf.id);await new Promise(r=>setTimeout(r,1800))
await p.type('#q','用 smiles 和 reaction 代码块，简洁说明苯和乙醇酯化，写条件');await p.click('#btn-send')
for(let i=0;i<60;i++){
  const n=await p.evaluate(()=>document.querySelectorAll('.answer .chem-figure').length)
  if(n>0){await new Promise(r=>setTimeout(r,4000));break}
  await new Promise(r=>setTimeout(r,1500))
}
const state=await p.evaluate(()=>({figs:document.querySelectorAll('.answer .chem-figure').length,svgs:document.querySelectorAll('.answer .chem-figure svg').length,states:[...document.querySelectorAll('.answer .chem-figure')].map(x=>x.dataset.state),kinds:[...document.querySelectorAll('.answer .chem-figure')].map(x=>x.dataset.kind)}))
console.log(state,'errs',errs.slice(0,4))
await p.screenshot({path:'chem-answer.png',fullPage:false})
await b.close()
