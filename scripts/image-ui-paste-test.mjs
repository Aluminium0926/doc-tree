import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1440,height:1000}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1000))
const before=await p.evaluate(async()=>(await (await fetch('/api/state')).json()).docs.length)
// open image doc
const imgDoc=await p.evaluate(async()=>{const s=await (await fetch('/api/state')).json();return s.docs.find(d=>d.kind==='image')})
await p.evaluate((id)=>{const items=[...document.querySelectorAll('.doc-item')];const el=items.find(x=>x.textContent.includes('测试图片'));el?.click()},imgDoc.id)
await new Promise(r=>setTimeout(r,1200))
const view=await p.evaluate(()=>({img:!!document.querySelector('.image-page img'),src:document.querySelector('.image-page img')?.src?.slice(0,40),meta:document.querySelector('#doc-meta')?.textContent}))
console.log('view',view)
// simulate clipboard image paste
const paste=await p.evaluate(async(id)=>{
  const blob=await (await fetch('/api/file/'+id)).blob()
  const file=new File([blob],'clipboard-shot.png',{type:'image/png'})
  const dt=new DataTransfer();dt.items.add(file)
  const ev=new Event('paste',{bubbles:true,cancelable:true})
  Object.defineProperty(ev,'clipboardData',{value:dt})
  document.dispatchEvent(ev)
  return true
},imgDoc.id)
await new Promise(r=>setTimeout(r,3000))
const after=await p.evaluate(async()=>{const s=await (await fetch('/api/state')).json();return {n:s.docs.length,last:s.docs.slice(0,2).map(d=>({title:d.title,kind:d.kind}))}})
console.log('docs before',before,'after',after)
console.log('errs',errs.slice(0,4))
await p.screenshot({path:'image-paste-view.png'})
await b.close()
