import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
const CONFIG = path.join(process.cwd(), 'data', 'config.json')
const backup = fs.readFileSync(CONFIG, 'utf8')
const srv = http.createServer((req, res) => {
  let body=''; req.on('data', c=>body+=c); req.on('end', ()=>{
    const j = JSON.parse(body||'{}')
    if (j.stream) { res.writeHead(200, {'content-type':'text/event-stream'}); res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'); res.end('data: [DONE]\n\n') }
    else { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({ choices:[{message:{content:'收到，之后用英文'}}] })) }
  })
})
await new Promise(r=>srv.listen(4413,'127.0.0.1',r))
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
const errs=[]; p.on('pageerror', e=>errs.push(e.message.slice(0,160)))
try {
  await fetch('http://127.0.0.1:4317/api/config', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:'http://127.0.0.1:4413/v1',apiKey:'k',model:'m',apiFormat:'openai'})})
  const st = await (await fetch('http://127.0.0.1:4317/api/state')).json()
  const doc = st.docs.find(d=>!d.hidden && d.kind==='pdf')
  await p.goto('http://127.0.0.1:4317/?doc='+doc.id, {waitUntil:'networkidle2'})
  await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
  await p.reload({waitUntil:'networkidle2'})
  await new Promise(r=>setTimeout(r,900))
  const before = await (await fetch('http://127.0.0.1:4317/api/doc/'+doc.id)).json()
  const nodes0 = Object.keys(before.tree.nodes).length
  await p.click('#btn-instr')
  const on = await p.evaluate(()=>({ cls: document.querySelector('#btn-instr').className, ph: document.querySelector('#q').placeholder }))
  await p.click('#q')
  await p.keyboard.type('以后用英文回答')
  await p.keyboard.press('Enter')
  await new Promise(r=>setTimeout(r,1200))
  const after = await (await fetch('http://127.0.0.1:4317/api/doc/'+doc.id)).json()
  const toast1 = await p.evaluate(()=>document.querySelector('#toast')?.textContent)
  const nodes1 = Object.keys(after.tree.nodes).length
  // 清除
  await p.click('#btn-instr')
  await p.click('#q')
  await p.keyboard.type('清除指令')
  await p.keyboard.press('Enter')
  await new Promise(r=>setTimeout(r,1000))
  const after2 = await (await fetch('http://127.0.0.1:4317/api/doc/'+doc.id)).json()
  const toast2 = await p.evaluate(()=>document.querySelector('#toast')?.textContent)
  console.log(JSON.stringify({ on, nodes0, nodes1, stored: after.doc.instructions, toast1, cleared: after2.doc.instructions, toast2, errs }))
} finally {
  fs.writeFileSync(CONFIG, backup)
  await b.close(); srv.close()
}
