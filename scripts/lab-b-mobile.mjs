import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu','--enable-features=SharedArrayBuffer'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage();const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});p.on('pageerror',e=>errs.push('PAGEERROR '+e.message))
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
await p.evaluate(()=>document.querySelector('#btnB').click())
for(let i=0;i<40;i++){
  const st=await p.evaluate(()=>({b:!!window.__lastB,log:document.querySelector('#log').textContent}))
  if(/B: 完成|B 失败/.test(st.log)){console.log(st.log.split('\n').slice(-8).join('\n'));break}
  await new Promise(r=>setTimeout(r,3000))
}
console.log('COI',await p.evaluate(()=>window.crossOriginIsolated),'ERRS',errs.slice(0,3))
await b.close()
