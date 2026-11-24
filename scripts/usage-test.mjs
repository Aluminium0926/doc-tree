import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  const j = JSON.parse(b||'{}')
  res.writeHead(200,{'content-type':'text/event-stream'})
  const hasTool = (j.messages||[]).some(m=>m.role==='tool')
  if (!hasTool) {
    res.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_page","arguments":"{\\"page\\":42}"}}]}}]}\n\n')
    res.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n')
    res.end('data: [DONE]\n\n')
  } else {
    res.write('data: {"choices":[{"delta":{"content":"回答"}}]}\n\n')
    res.write('data: {"choices":[],"usage":{"prompt_tokens":1200,"completion_tokens":80,"total_tokens":1280,"prompt_cache_hit_tokens":900,"prompt_cache_miss_tokens":300}}\n\n')
    res.end('data: [DONE]\n\n')
  }
}) })
await new Promise(r=>srv.listen(4418,'127.0.0.1',r))
const base='http://127.0.0.1:4317'
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)))
try {
  await fetch(base+'/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4418/v1',apiKey:'k',model:'m',apiFormat:'openai'})})
  const st = await (await fetch(base+'/api/state')).json()
  const doc = st.docs.find(d=>d.kind==='pdf' && d.pages>=42)
  await p.goto(base+'/?doc='+doc.id,{waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,900))
  const before = await (await fetch(base+'/api/doc/'+doc.id)).json()
  await p.click('#q'); await p.keyboard.type('讲第42页'); await p.click('#btn-send')
  await new Promise(r=>setTimeout(r,2200))
  const after = await (await fetch(base+'/api/doc/'+doc.id)).json()
  const fresh = Object.values(after.tree.nodes).filter(n=>!before.tree.nodes[n.id])
  const node = fresh[fresh.length-1]
  const ui = await p.evaluate(()=>{ const all=[...document.querySelectorAll('.node-usage')]; return all.length ? all[all.length-1].textContent : '' })
  console.log(JSON.stringify({ usage: node?.usage, ui, errs }, null, 1))
} finally { fs.writeFileSync(CONFIG, backup); await b.close(); srv.close() }
