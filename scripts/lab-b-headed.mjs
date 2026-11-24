import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:false,args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage();const logs=[]
p.on('console',m=>{if(m.type()==='error')logs.push(m.text().slice(0,200))})
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_Classification_FINAL.pptx')
await p.evaluate(()=>document.querySelector('#btnB').click())
for(let i=0;i<40;i++){
  const st=await p.evaluate(()=>({b:!!window.__lastB,log:document.querySelector('#log').textContent}))
  if(/B: 完成|B 失败/.test(st.log)){console.log('DONE',st.log.split('\n').slice(-4).join('\n'));break}
  await new Promise(r=>setTimeout(r,3000))
}
console.log('tail',(await p.evaluate(()=>document.querySelector('#log').textContent)).split('\n').slice(-4).join('\n'))
console.log('errs',logs.slice(-4))
await p.close();await b.close()
