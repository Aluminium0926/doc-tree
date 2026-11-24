import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage();const logs=[]
p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,220)))
p.on('pageerror',e=>logs.push('PAGEERROR '+e.message))
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_Classification_FINAL.pptx')
await p.evaluate(()=>document.querySelector('#btnB').click())
for(let i=0;i<40;i++){
  const st=await p.evaluate(()=>({b:!!window.__lastB,log:document.querySelector('#log').textContent}))
  if(/B: 完成|B 失败/.test(st.log)){console.log(st.log.split('\n').slice(-5).join('\n'));break}
  if(i%5===0)console.log('tick',i,st.log.split('\n').slice(-2).join(' | '))
  await new Promise(r=>setTimeout(r,3000))
}
console.log(logs.slice(-12).join('\n'))
await b.close()
