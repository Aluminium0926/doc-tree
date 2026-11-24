import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'});await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'));await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1000))
await p.evaluate(()=>document.activeElement?.blur());await new Promise(r=>setTimeout(r,1700))
console.log('heartbeat active',await p.evaluate(()=>document.activeElement?.id))
await p.keyboard.type('xyz');console.log('val',await p.evaluate(()=>document.querySelector('#q')?.value))
await b.close()
