import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu','--enable-features=SharedArrayBuffer'],defaultViewport:{width:1400,height:1000}})
const p=await b.newPage()
const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text().slice(0,300))})
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await p.$('#file').then(i=>i.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_and_Classification_EN.pptx'))
await p.evaluate(()=>document.querySelector('#btnB').click())
let done=false
for(let i=0;i<120;i++){
  const state=await p.evaluate(()=>({b:!!window.__lastB,log:document.querySelector('#log').textContent}))
  if(/B: 完成|B 失败/.test(state.log)){console.log(state.log.split('\n').slice(-12).join('\n'));done=true;break}
  if(i%10===0)console.log('tick',i,state.log.split('\n').slice(-2).join(' | '))
  await new Promise(r=>setTimeout(r,5000))
}
if(!done)console.log('TIMEOUT',await p.evaluate(()=>document.querySelector('#log').textContent.split('\n').slice(-10).join('\n')))
const out=await p.evaluate(()=>window.__lastB||null)
if(out){fs.writeFileSync('scripts/lab-B.pdf',Buffer.from(out.b64,'base64'));console.log('saved',out.name,Buffer.from(out.b64,'base64').length)}
console.log('ERRS',errs.slice(0,6))
await p.screenshot({path:'ppt-lab-B.png'})
await b.close()
