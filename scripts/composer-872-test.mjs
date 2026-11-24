import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:872,height:900}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>{localStorage.removeItem('dt:left');localStorage.setItem('dt:seenWelcome','1')})
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,900))
await p.evaluate(()=>{document.querySelector('#status').textContent='生成中…';document.querySelector('#btn-stop').hidden=false})
const m=await p.evaluate(()=>{
  const c=document.querySelector('#composer').getBoundingClientRect()
  const ids=['status','btn-instr','btn-stop','btn-send']
  const o={composer:{x:Math.round(c.x),w:Math.round(c.width)}}
  for(const id of ids){const r=document.getElementById(id).getBoundingClientRect();o[id]={x:Math.round(r.x),w:Math.round(r.width),right:Math.round(r.right)}}
  return o
})
console.log(JSON.stringify(m,null,1))
await p.screenshot({path:'composer-872.png',clip:{x:541,y:600,width:331,height:300}})
await b.close()
