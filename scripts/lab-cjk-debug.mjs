import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1400,height:1000}})
const p=await b.newPage();const errs=[]
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,250))});p.on('pageerror',e=>errs.push('PAGEERROR '+e.message))
await p.goto('http://127.0.0.1:4503/ppt-lab/',{waitUntil:'networkidle2'})
await (await p.$('#file')).uploadFile('C:/Users/wangk/Desktop/xwechat_files/wxid_qxz547baiwrr32_68cd/msg/file/2026-11/chapter-13-heterocycles+杂环化合物和维生素.pptx')
await p.evaluate(()=>document.querySelector('#btnA').click())
await new Promise(r=>setTimeout(r,10000))
console.log(await p.evaluate(()=>document.querySelector('#log').textContent.slice(-800)))
console.log('outA',await p.evaluate(()=>document.querySelector('#outA').innerText),'errs',errs.slice(0,4))
await b.close()
