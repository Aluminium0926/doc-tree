import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:1000}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Organic/Chapter-2-Alkanes+烷烃与环烷烃.pptx')
await p.evaluate(()=>document.querySelector('#btnA').click())
let out=null
for(let i=0;i<40;i++){out=await p.evaluate(()=>window.__lastA||null);if(out)break;await new Promise(r=>setTimeout(r,1500))}
if(out){fs.writeFileSync('scripts/lab-CJK.pdf',Buffer.from(out.b64,'base64'));console.log('saved',out.name)}
else console.log('no out',await p.evaluate(()=>document.querySelector('#log').textContent.slice(-300)))
await b.close()

