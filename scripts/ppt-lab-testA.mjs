import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:1000}})
const p=await b.newPage()
const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,300))})
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await p.$('#file').then(i=>i.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx'))
await new Promise(r=>setTimeout(r,500))
await p.evaluate(()=>document.querySelector('#btnA').click())
for(let i=0;i<40;i++){
  const txt=await p.evaluate(()=>document.querySelector('#log').textContent)
  if(/A: 完成|A 失败/.test(txt)){console.log(txt.split('\n').slice(-10).join('\n'));break}
  await new Promise(r=>setTimeout(r,1500))
}
const out=await p.evaluate(()=>({out:document.querySelector('#outA').innerText,logTail:document.querySelector('#log').textContent.split('\n').slice(-4)}))
console.log('OUT',JSON.stringify(out),'ERRS',errs.slice(0,5))
await p.screenshot({path:'ppt-lab-A.png'})
await b.close()
