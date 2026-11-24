import puppeteer from 'puppeteer-core'
for (const isMobile of [false, true]) {
  const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile,hasTouch:isMobile}})
  const p=await b.newPage();const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))})
  await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
  await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
  await p.evaluate(()=>document.querySelector('#btnB').click())
  let done=false
  for(let i=0;i<30;i++){
    const st=await p.evaluate(()=>({b:!!window.__lastB,log:document.querySelector('#log').textContent}))
    if(/B: 完成|B 失败/.test(st.log)){console.log('isMobile',isMobile,'DONE',st.log.split('\n').slice(-2).join(' | '));done=true;break}
    await new Promise(r=>setTimeout(r,3000))
  }
  if(!done)console.log('isMobile',isMobile,'TIMEOUT',await p.evaluate(()=>document.querySelector('#log').textContent.split('\n').slice(-3).join(' | ')))
  await b.close()
}
