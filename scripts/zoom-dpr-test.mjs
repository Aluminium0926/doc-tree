import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:800,deviceScaleFactor:2}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
const doc=st.docs.find(d=>d.kind==='pdf')
await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
await new Promise(r=>setTimeout(r,1500))
const measure=()=>p.evaluate(()=>{const page=document.querySelector('.page[data-page="1"]');const c=page.querySelector('canvas');const r=c.getBoundingClientRect();return {zoom:document.querySelector('#zoom-label').textContent,cw:c.width,css:Math.round(r.width),ratio:+(c.width/r.width).toFixed(2)}})
const at100=await measure()
for(let i=0;i<8;i++){await p.keyboard.down('Control');await p.keyboard.press('-');await p.keyboard.up('Control');await new Promise(r=>setTimeout(r,120))}
await new Promise(r=>setTimeout(r,1200))
const at40=await measure()
for(let i=0;i<12;i++){await p.keyboard.down('Control');await p.keyboard.press('+');await p.keyboard.up('Control');await new Promise(r=>setTimeout(r,120))}
await new Promise(r=>setTimeout(r,1200))
const at180=await measure()
console.log(JSON.stringify({at100,at40,at180},null,1))
await b.close()
