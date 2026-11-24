import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req,res)=>{ let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
  const j = JSON.parse(body||'{}')
  res.writeHead(200,{'content-type':'text/event-stream'})
  const isResume = (j.messages||[]).some(m=>m.role==='assistant')
  if (isResume) {
    res.write('data: {"choices":[{"delta":{"content":"续写内容"}}]}\n\n')
    res.end('data: [DONE]\n\n')
  } else {
    let n=0
    const timer=setInterval(()=>{
      res.write('data: '+JSON.stringify({choices:[{delta:{content:'片段'+n}}]})+'\n\n')
      n++
      if(n>=60){clearInterval(timer);res.end('data: [DONE]\n\n')}
    },150)
    req.on('close',()=>clearInterval(timer))
  }
}) })
await new Promise(r=>srv.listen(4421,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try {
  await fetch(base+'/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4421/v1',apiKey:'k',model:'m',apiFormat:'openai'})})
  const st = await (await fetch(base+'/api/state')).json()
  const doc = st.docs.find(d=>d.kind==='pdf')
  await p.goto(base+'/?doc='+doc.id,{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,800))
  await p.click('#q'); await p.keyboard.type('测试继续'); await p.click('#btn-send')
  await new Promise(r=>setTimeout(r,2200))
  await p.click('#btn-stop')
  await new Promise(r=>setTimeout(r,800))
  const afterStop = await p.evaluate(()=>({ resumeBtn: !!document.querySelector('.node [data-act="resume"]'), status: document.querySelector('#status').textContent }))
  await p.evaluate(() => { const els=[...document.querySelectorAll('.node [data-act="resume"]')]; els[els.length-1]?.click() })
  await new Promise(r=>setTimeout(r,700))
  const toast = await p.evaluate(()=>document.querySelector('#toast')?.textContent || '')
  const status2 = await p.evaluate(()=>document.querySelector('#status').textContent)
  console.log('TOAST', toast, 'STATUS', status2)
  await new Promise(r=>setTimeout(r,1200))
  const afterResume = await p.evaluate(()=>{
    const cards=[...document.querySelectorAll('.node')]
    const last=cards[cards.length-1]
    return { answer: last?.querySelector('.answer')?.innerText || '', resumeBtn: !!last?.querySelector('[data-act="resume"]') }
  })
  const tree = await (await fetch(base+'/api/doc/'+doc.id)).json()
  const nodes = Object.values(tree.tree.nodes).sort((a,b)=>a.createdAt-b.createdAt)
  const last = nodes[nodes.length-1]
  console.log(JSON.stringify({ afterStop, afterResume, node: { stopped: !!last?.stopped, answerLen: (last?.answer||'').length, tail: (last?.answer||'').slice(-20) }, errs }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); await b.close(); srv.close() }
