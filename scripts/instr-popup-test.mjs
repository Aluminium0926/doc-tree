import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ const j=JSON.parse(b||'{}'); if(j.stream){res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');res.end('data: [DONE]\n\n')} else {res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:'收到'}}]}))} }) })
await new Promise(r=>srv.listen(4415,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const post=(p,b)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try {
  await post('/api/config',{baseUrl:'http://127.0.0.1:4415/v1',apiKey:'k',model:'m',apiFormat:'openai'})
  const st = await (await fetch(base+'/api/state')).json()
  const doc = st.docs.find(d=>!d.hidden && d.kind==='pdf')
  await post('/api/instruction',{docId:doc.id,text:'回答用中文，名词附英文'})
  await post('/api/instruction',{docId:doc.id,text:'结论先行，不超过三句'})
  await p.goto(base+'/?doc='+doc.id,{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,900))
  const meta = await p.evaluate(()=>document.querySelector('#doc-meta').innerText)
  await p.click('.meta-instr')
  await new Promise(r=>setTimeout(r,300))
  const pop = await p.evaluate(()=>({ visible: !document.querySelector('#instr-pop').hidden, items: [...document.querySelectorAll('.instr-item span')].map(x=>x.textContent), clear: !!document.querySelector('#instr-clear') }))
  const box = await p.evaluate(()=>{ const r=document.querySelector('#instr-pop').getBoundingClientRect(); return {x:Math.round(r.x)-10,y:Math.round(r.y)-10,width:Math.round(r.width)+20,height:Math.round(r.height)+20} })
  await p.screenshot({path:'instr-pop.png', clip: box})
  await p.click('.instr-item button')
  await new Promise(r=>setTimeout(r,800))
  const afterDel = await p.evaluate(()=>({ meta: document.querySelector('#doc-meta').innerText, hidden: document.querySelector('#instr-pop').hidden, items: document.querySelectorAll('.instr-item').length }))
  // 重新打开，测试清空
  await p.click('.meta-instr'); await new Promise(r=>setTimeout(r,250))
  await p.click('#instr-clear'); await new Promise(r=>setTimeout(r,800))
  const afterClear = await p.evaluate(()=>({ meta: document.querySelector('#doc-meta').innerText, hidden: document.querySelector('#instr-pop').hidden }))
  console.log(JSON.stringify({ meta, pop, afterDel, afterClear, errs }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); await b.close(); srv.close() }
