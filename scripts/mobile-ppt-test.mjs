import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,200))})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,800))
const input=await p.$('#file-input')
await input.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
let last=''
for(let i=0;i<90;i++){
  const st=await p.evaluate(()=>({status:document.querySelector('#status')?.textContent||'',toast:document.querySelector('#toast')?.textContent||'',log:(document.querySelector('#log')||{}).textContent||''}))
  if(st.status!==last){console.log('STATUS',st.status);last=st.status}
  if(/已转换并导入|已导入|失败|暂不支持/.test(st.status) || /失败|暂不支持/.test(st.toast)) {console.log('TOAST',st.toast);break}
  await new Promise(r=>setTimeout(r,2000))
}
const st=await p.evaluate(async()=>{const j=await (await fetch('/api/state')).json();const d=j.docs[0];const det=d?await (await fetch('/api/doc/'+d.id)).json():null;return {docs:j.docs.map(x=>({title:x.title,kind:x.kind,pages:x.pages})),detKind:det?.doc?.kind,detPages:det?.doc?.pages?.length}})
console.log(JSON.stringify(st,null,1));console.log('ERRS',errs.slice(0,6))
await p.screenshot({path:'mobile-ppt-import.png'})
await b.close()
