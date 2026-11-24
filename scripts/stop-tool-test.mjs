import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req,res)=>{
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    const j = JSON.parse(body||'{}')
    res.writeHead(200, {'content-type':'text/event-stream'})
    const hasTool = (j.messages||[]).some(m=>m.role==='tool')
    if (!hasTool) {
      res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_page","arguments":"{\\"page\\":42}"}}]}}]}\n\n')
      res.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n')
      res.end('data: [DONE]\n\n')
    } else {
      let n = 0
      const timer = setInterval(() => {
        res.write('data: ' + JSON.stringify({choices:[{delta:{content:'片段' + n}}]}) + '\n\n')
        n++
        if (n >= 40) { clearInterval(timer); res.end('data: [DONE]\n\n') }
      }, 150)
      req.on('close', () => clearInterval(timer))
    }
  })
})
await new Promise(r=>srv.listen(4417,'127.0.0.1',r))
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try {
  await fetch('http://127.0.0.1:4317/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4417/v1',apiKey:'k',model:'m',apiFormat:'openai'})})
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const doc = st.docs.find(d=>d.kind==='pdf' && d.pages>=42)
  await p.goto('http://127.0.0.1:4317/?doc='+doc.id,{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,900))
  await p.click('#q'); await p.keyboard.type('讲第42页')
  const beforeNodes = (await (await fetch('http://127.0.0.1:4317/api/doc/'+doc.id)).json()).tree
  await p.click('#btn-send')
  await new Promise(r=>setTimeout(r,900))
  const mid = await p.evaluate(()=>({ status: document.querySelector('#status').textContent, stopVisible: !document.querySelector('#btn-stop').hidden, sendDisabled: document.querySelector('#btn-send').disabled }))
  await new Promise(r=>setTimeout(r,1200))
  await p.click('#btn-stop')
  await new Promise(r=>setTimeout(r,900))
  const after = await p.evaluate(()=>({ status: document.querySelector('#status').textContent, stopHidden: document.querySelector('#btn-stop').hidden, sendEnabled: !document.querySelector('#btn-send').disabled }))
  const tree = (await (await fetch('http://127.0.0.1:4317/api/doc/'+doc.id)).json()).tree
  const nodes = Object.values(tree.nodes).filter(n=>!beforeNodes.nodes[n.id])
  const last = nodes[nodes.length-1]
  console.log(JSON.stringify({ mid, after, node: { error: last?.error || null, answerLen: (last?.answer||'').length, question: last?.question }, errs }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); await b.close(); srv.close() }
