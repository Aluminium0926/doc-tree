import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:800,deviceScaleFactor:1}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1500))
const measure=()=>p.evaluate(()=>{
  const page=document.querySelector('.page[data-page="1"]'); const c=page?.querySelector('canvas'); const r=c?.getBoundingClientRect()
  return {zoom:document.querySelector('#zoom-label')?.textContent, canvasW:c?.width, cssW:r?Math.round(r.width):0, ratio:c&&r?+(c.width/r.width).toFixed(2):0, drawn:page?.dataset.drawn}
})
console.log('start',await measure())
for(let i=0;i<5;i++){await p.click('#btn-zoom-out');await new Promise(r=>setTimeout(r,250))}
await new Promise(r=>setTimeout(r,1200))
console.log('zoomed',await measure())
await p.screenshot({path:'zoom-out.png'})
await b.close()
