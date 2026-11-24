import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:950}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1200))
const docs=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs)
const pdfs=docs.filter(d=>d.kind==='pdf').slice(0,4)
async function click(t){await p.evaluate((t)=>{[...document.querySelectorAll('.doc-item')].find(x=>x.textContent.includes(t))?.click()},t);await new Promise(r=>setTimeout(r,2200))}
await click(pdfs[0].title)
for(let k=0;k<8;k++){
  const target=await p.evaluate(()=>Math.round(document.querySelector('#page-scroll').scrollHeight*0.35))
  await p.evaluate((y)=>{document.querySelector('#page-scroll').scrollTop=y;document.querySelector('#tree').scrollTop=Math.round(document.querySelector('#tree').scrollHeight*0.4)},target)
  await new Promise(r=>setTimeout(r,500))
  const before=await p.evaluate(()=>({scroll:document.querySelector('#page-scroll').scrollTop,tree:document.querySelector('#tree').scrollTop}))
  await click(pdfs[1].title)
  await click(pdfs[0].title)
  await new Promise(r=>setTimeout(r,1200))
  const after=await p.evaluate(()=>({scroll:document.querySelector('#page-scroll').scrollTop,tree:document.querySelector('#tree').scrollTop,max:document.querySelector('#page-scroll').scrollHeight}))
  console.log(k+1,'before',before,'after',after,'ok',Math.abs(before.scroll-after.scroll)<5,'treeOk',Math.abs(before.tree-after.tree)<5)
}
console.log('errs',errs.slice(0,3))
await b.close()
