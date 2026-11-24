import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1440,height:1000}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,150))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1200))
const has=await p.$('#btn-web');console.log('web button',!!has, has?await p.evaluate(()=>document.querySelector('#btn-web').className):'')
const docs=await p.$$('.doc-item');console.log('docs',docs.length)
if(docs.length)await docs[0].click()
await new Promise(r=>setTimeout(r,1000))
await p.click('#btn-web')
await p.type('#q','请联网搜索今天北京的天气，并给出来源')
await p.click('#btn-send')
let done=false
for(let i=0;i<40;i++){
  const t=await p.evaluate(()=>document.body.innerText)
  if(t.includes('来源')&&t.includes('北京')){console.log('GOT SOURCES');done=true;break}
  if(t.includes('请求失败')||t.includes('不支持')){console.log('ERR TEXT',t.slice(-300));break}
  await new Promise(r=>setTimeout(r,1500))
}
const tail=await p.evaluate(()=>document.body.innerText.slice(-700))
console.log(tail)
console.log('errs',errs.slice(0,4))
await p.screenshot({path:'websearch-ui.png'})
await b.close()
