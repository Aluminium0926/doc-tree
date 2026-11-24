import puppeteer from 'puppeteer-core'
for (const [w,flag] of [[390,true],[1400,false],[1400,true]]) {
  const args=['--no-sandbox','--disable-gpu']; if(flag)args.push('--enable-features=SharedArrayBuffer')
  const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args,defaultViewport:{width:w,height:900}})
  const p=await b.newPage();const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100))})
  await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
  await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
  await p.evaluate(()=>document.querySelector('#btnB').click())
  let done=false
  for(let i=0;i<25;i++){
    const st=await p.evaluate(()=>({b:!!window.__lastB,log:document.querySelector('#log').textContent}))
    if(/B: 完成|B 失败/.test(st.log)){console.log('w',w,'flag',flag,'DONE');done=true;break}
    await new Promise(r=>setTimeout(r,3000))
  }
  if(!done)console.log('w',w,'flag',flag,'TIMEOUT',errs.slice(0,4))
  await b.close()
}
