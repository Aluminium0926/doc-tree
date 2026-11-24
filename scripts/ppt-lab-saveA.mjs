import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:1000}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await p.$('#file').then(i=>i.uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx'))
await p.evaluate(()=>document.querySelector('#btnA').click())
for(let i=0;i<40;i++){
  const done=await p.evaluate(()=>!!window.__lastA)
  if(done)break
  await new Promise(r=>setTimeout(r,1500))
}
const out=await p.evaluate(()=>window.__lastA)
if(out){fs.writeFileSync('scripts/lab-A.pdf',Buffer.from(out.b64,'base64'));console.log('saved',out.name,Buffer.from(out.b64,'base64').length)}
else console.log('no output')
await b.close()
