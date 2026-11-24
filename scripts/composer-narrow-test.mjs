import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:728,height:900}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>{localStorage.removeItem('dt:left');localStorage.setItem('dt:seenWelcome','1')})
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,900))
await p.evaluate(()=>{const s=document.querySelector('#status');s.textContent='生成中…';document.querySelector('#btn-stop').hidden=false;document.querySelector('#composer').classList.add('busy')})
const m=await p.evaluate(()=>{
  const c=document.querySelector('#composer').getBoundingClientRect(), f=document.querySelector('.composer-foot').getBoundingClientRect();
  const ids=['status','btn-instr','btn-stop','btn-send','effort']
  const out={composer:Math.round(c.width),foot:Math.round(f.width)}
  for(const id of ids){const el=document.getElementById(id)||document.querySelector('.'+id); if(!el){out[id]=null;continue}; const r=el.getBoundingClientRect(); out[id]={x:Math.round(r.x),w:Math.round(r.width),display:getComputedStyle(el).display}}
  return out
})
console.log(JSON.stringify(m,null,1))
await p.screenshot({path:'composer-narrow.png',clip:{x:0,y:600,width:728,height:300}})
await b.close()
