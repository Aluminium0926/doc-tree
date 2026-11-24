import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:872,height:900}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>{localStorage.removeItem('dt:left');localStorage.setItem('dt:seenWelcome','1')})
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1000))
const info=await p.evaluate(()=>{
  const out={}
  for(const id of ['btn-search','btn-shot','btn-rotate','btn-theme','page-nav']){
    const el=document.getElementById(id); const r=el.getBoundingClientRect(); const s=getComputedStyle(el)
    const parent=el.parentElement.getBoundingClientRect()
    out[id]={x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,visibility:s.visibility,opacity:s.opacity,parentW:parent.width,parentX:parent.x,scrollW:el.parentElement.scrollWidth}
  }
  const tb=document.querySelector('#toolbar').getBoundingClientRect(); const acts=document.querySelector('.tb-actions').getBoundingClientRect()
  out.toolbar={x:tb.x,w:tb.width}; out.actions={x:acts.x,w:acts.width,scroll:document.querySelector('.tb-actions').scrollWidth}
  return out
})
console.log(JSON.stringify(info,null,1))
await p.screenshot({path:'toolbar-crop.png',clip:{x:0,y:0,width:600,height:70}})
await b.close()
