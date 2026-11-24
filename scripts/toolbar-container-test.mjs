import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1766,height:900}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>{localStorage.removeItem('dt:left');localStorage.setItem('dt:seenWelcome','1')})
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1200))
const m=await p.evaluate(()=>{
  const tb=document.querySelector('#toolbar').getBoundingClientRect(), v=document.querySelector('#viewer').getBoundingClientRect()
  const ids=['btn-zoom-out','btn-zoom-in','btn-search','btn-rotate','btn-theme','btn-hl','btn-eraser','btn-shot','page-nav']
  const o={viewer:Math.round(v.width),toolbarH:Math.round(tb.height),toolbarW:Math.round(tb.width),items:{}}
  for(const id of ids){const el=document.getElementById(id); if(!el){continue}; const r=el.getBoundingClientRect();o.items[id]={x:Math.round(r.x),w:Math.round(r.width),inside:r.x>=tb.x&&r.right<=tb.right}}
  return o
})
console.log(JSON.stringify(m,null,1))
await p.screenshot({path:'toolbar-viewport1766.png',clip:{x:0,y:0,width:1400,height:120}})
await b.close()
