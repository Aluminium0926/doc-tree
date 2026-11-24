import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:728,height:900}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>{localStorage.removeItem('dt:left');localStorage.setItem('dt:seenWelcome','1')})
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,900))
const m=await p.evaluate(()=>{
  const app=document.querySelector('#app'), v=document.querySelector('#viewer'), s=document.querySelector('#sidebar'), c=document.querySelector('#composer')
  const cs=getComputedStyle(app)
  return {inner:innerWidth, cols:cs.gridTemplateColumns, right:cs.getPropertyValue('--right'), left:cs.getPropertyValue('--left'), appW:app.getBoundingClientRect().width, viewerW:v.getBoundingClientRect().width, sideW:s.getBoundingClientRect().width, composerW:c.getBoundingClientRect().width}
})
console.log(JSON.stringify(m,null,1))
await b.close()
