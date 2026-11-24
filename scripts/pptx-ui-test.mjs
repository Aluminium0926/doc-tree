import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,700))
const input=await p.$('#file-input')
await input.uploadFile('scripts/fixture-test.pptx')
await new Promise(r=>setTimeout(r,1800))
const ppt=await p.evaluate(()=>{
  const sheet=document.querySelector('#sheet')
  return {text:sheet?.innerText.slice(0,120)||'', meta:document.querySelector('#doc-meta')?.innerText||'', errors:0}
})
// 非法扩展名：应只 toast，不发起导入
fs.writeFileSync('scripts/fake.ppt','not a ppt')
const before=await p.evaluate(async()=>({n:(await (await fetch('/api/state')).json()).docs.length}))
await input.uploadFile('scripts/fake.ppt')
await new Promise(r=>setTimeout(r,700))
const after=await p.evaluate(async()=>({n:(await (await fetch('/api/state')).json()).docs.length, toast:document.querySelector('#toast')?.textContent||''}))
console.log(JSON.stringify({ppt,before,after,errs},null,1))
await p.screenshot({path:'pptx-open.png'})
await b.close()
