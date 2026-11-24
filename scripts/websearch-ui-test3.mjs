import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1440,height:1000}})
const p=await b.newPage()
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1000))
const docs=await p.$$('.doc-item');if(docs.length)await docs[0].click();await new Promise(r=>setTimeout(r,800))
await p.click('#btn-web');await p.type('#q','请联网搜索今天北京的天气，并给出来源');await p.click('#btn-send')
for(let i=0;i<12;i++){
  await new Promise(r=>setTimeout(r,10000))
  const s=await p.evaluate(()=>({status:document.querySelector('#status')?.textContent||'',links:[...document.querySelectorAll('a[href^="http"]')].filter(a=>/weather|天气|qq|sohu|news/.test(a.href)||/天气/.test(a.textContent)).map(a=>a.textContent+' | '+a.href),tail:document.body.innerText.slice(-250)}))
  console.log(i*10+'s','status=',s.status,'weatherLinks=',s.links.length)
  if(s.links.length){console.log(s.links.slice(0,4));break}
  if(!s.status)break
}
await b.close()
