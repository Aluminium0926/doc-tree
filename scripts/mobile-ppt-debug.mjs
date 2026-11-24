import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:390,height:844,isMobile:true,hasTouch:true}})
const p=await b.newPage();const logs=[]
p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,250)))
p.on('pageerror',e=>logs.push('PAGEERROR '+e.message))
p.on('response',r=>{if(r.url().includes('/vendor/libreoffice')) logs.push('RESP '+r.status()+' '+r.url().split('/').pop())})
await p.goto('http://127.0.0.1:4501/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,600))
await (await p.$('#file-input')).uploadFile('C:/Users/wangk/Desktop/大肥鱼的家/Cancer_Detection_Classification_FINAL_定稿_V4.2.pptx')
await new Promise(r=>setTimeout(r,30000))
console.log(logs.slice(-40).join('\n'))
console.log('status',await p.evaluate(()=>document.querySelector('#status')?.textContent))
await b.close()
