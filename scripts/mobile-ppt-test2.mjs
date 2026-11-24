import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,700))
await (await p.$('#file-input')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
let last=''
for(let i=0;i<90;i++){
  const st=await p.evaluate(()=>({status:document.querySelector('#status')?.textContent||'',toast:document.querySelector('#toast')?.textContent||'',docs:document.querySelectorAll('.doc-item').length,coi:window.crossOriginIsolated}))
  if(st.status!==last){console.log(i*3+'s',st.status,'toast=',st.toast);last=st.status}
  if(/已转换并导入|已导入|失败|暂不支持/.test(st.status) || /失败|暂不支持/.test(st.toast)) break
  await new Promise(r=>setTimeout(r,3000))
}
const docs=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();return j.docs.map(d=>({title:d.title,kind:d.kind,pages:d.pages}))})
console.log('DOCS',JSON.stringify(docs));console.log('COI',await p.evaluate(()=>window.crossOriginIsolated));console.log('ERRS',errs.slice(0,5))
await b.close()
