import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG=path.join(process.cwd(),'data','config.json')
const backup=fs.readFileSync(CONFIG,'utf8')
const srv=http.createServer((req,res)=>{req.resume();req.on('end',()=>{
  res.writeHead(200,{'content-type':'text/event-stream'})
  const text='水：\\ce{H2O} 和 $\\ce{NH3}$ 都能给出质子。'
  res.write('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n')
  res.end('data: [DONE]\n\n')
})})
await new Promise(r=>srv.listen(4430,'127.0.0.1',r))
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1440,height:900}})
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try{
  await fetch('http://127.0.0.1:4317/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4430/v1',apiKey:'k',model:'m',apiFormat:'openai'})})
  const st=await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const doc=st.docs.find(d=>d.kind==='pdf')
  await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,800))
  const katex=await p.evaluate(()=>{try{return {ok:true,html:window.katex.renderToString('\\ce{NH3(aq) + H2O(l) <=> NH4+(aq) + OH-(aq)}',{throwOnError:true}).slice(0,80)}}catch(e){return {ok:false,err:String(e)}}})
  await p.click('#q');await p.keyboard.type('测试化学式');await p.click('#btn-send')
  await new Promise(r=>setTimeout(r,1500))
  await p.evaluate(()=>{const a=[...document.querySelectorAll('.answer')].pop(); if(a) a.scrollIntoView({block:'center'})})
  await p.screenshot({path:'mhchem.png'})
  const ans=await p.evaluate(()=>{const a=[...document.querySelectorAll('.answer')].pop();return {text:a?.innerText.slice(0,120),katex:a?.querySelectorAll('.katex').length,raw:a?.innerText.includes('\\ce')}})
  console.log(JSON.stringify({katex,ans,errs},null,1))
}finally{fs.writeFileSync(CONFIG,backup);await b.close();srv.close()}
