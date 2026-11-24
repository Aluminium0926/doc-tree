import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
const files=[
 'C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx',
 'C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_rebuilt.pptx',
 'C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_and_Classification_EN.pptx',
 'C:/Users/wangk/Desktop/大肥鱼的家/癌症活检-AI分类/Cancer_Detection_Classification_FINAL.pptx'
]
fs.mkdirSync('scripts/lab-batch',{recursive:true})
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu','--enable-features=SharedArrayBuffer'],defaultViewport:{width:1400,height:1000}})
const results=[]
async function runA(file, i){
  const p=await b.newPage()
  await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
  const input=await p.$('#file'); await input.uploadFile(file)
  const t0=Date.now()
  await p.evaluate(()=>document.querySelector('#btnA').click())
  let out=null
  for(let n=0;n<120;n++){
    out=await p.evaluate(()=>window.__lastA||null)
    if(out)break
    const log=await p.evaluate(()=>document.querySelector('#log').textContent)
    if(/A 失败/.test(log)) break
    await new Promise(r=>setTimeout(r,1500))
  }
  const ms=Date.now()-t0
  if(out){const buf=Buffer.from(out.b64,'base64');const dest=`scripts/lab-batch/A-${i}.pdf`;fs.writeFileSync(dest,buf);results.push({mode:'A',i,file:path.basename(file),kb:Math.round(buf.length/1024),ms})}
  else {const log=await p.evaluate(()=>document.querySelector('#log').textContent);results.push({mode:'A',i,file:path.basename(file),error:log.slice(-300)})}
  await p.close()
}
async function runB(files){
  const p=await b.newPage()
  await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
  for(let i=0;i<files.length;i++){
    const file=files[i]
    const input=await p.$('#file'); await input.uploadFile(file)
    await p.evaluate(()=>{delete window.__lastB; document.querySelector('#log').textContent=''})
    const t0=Date.now()
    await p.evaluate(()=>document.querySelector('#btnB').click())
    let out=null
    for(let n=0;n<160;n++){
      out=await p.evaluate(()=>window.__lastB||null)
      if(out)break
      const log=await p.evaluate(()=>document.querySelector('#log').textContent)
      if(/B 失败/.test(log)) break
      await new Promise(r=>setTimeout(r,2000))
    }
    const ms=Date.now()-t0
    if(out){const buf=Buffer.from(out.b64,'base64');fs.writeFileSync(`scripts/lab-batch/B-${i}.pdf`,buf);results.push({mode:'B',i,file:path.basename(file),kb:Math.round(buf.length/1024),ms})}
    else {const log=await p.evaluate(()=>document.querySelector('#log').textContent);results.push({mode:'B',i,file:path.basename(file),error:log.slice(-300)})}
  }
  await p.close()
}
for(let i=0;i<files.length;i++) await runA(files[i],i)
await runB(files)
console.log(JSON.stringify(results,null,1))
await b.close()
