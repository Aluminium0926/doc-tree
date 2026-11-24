import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage();const evs=[]
p.on('response',async r=>{if(r.url().includes('/api/import')){let t='';try{t=(await r.text()).slice(0,200)}catch{}evs.push({status:r.status(),t})}})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,800))
await p.evaluate(async()=>{const s=await (await fetch('/api/state')).json();const id=s.docs.find(d=>d.kind==='image').id;const blob=await (await fetch('/api/file/'+id)).blob();const file=new File([blob],'clip.png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(file);const ev=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(ev,'clipboardData',{value:dt});document.dispatchEvent(ev)})
await new Promise(r=>setTimeout(r,5000))
console.log('import responses',evs)
const out=await p.evaluate(async()=>{const s=await (await fetch('/api/state')).json();return {n:s.docs.length,toast:document.querySelector('#toast')?.textContent||'',status:document.querySelector('#status')?.textContent||''}})
console.log(out)
await b.close()
