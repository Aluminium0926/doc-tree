import puppeteer from 'puppeteer-core'
const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json()
let pick=null
for(const d of st.docs.filter(x=>x.kind==='pdf'&&!x.hidden)){
  const doc=await (await fetch(base+'/api/doc/'+d.id)).json()
  for(const p of doc.doc.pages||[]){
    const words=(p.text||'').toLowerCase().match(/[a-z]{5,}/g)||[]
    const counts={}
    for(const w of words)counts[w]=(counts[w]||0)+1
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]
    if(top && top[1]>=2){pick={doc:d,page:p.no,term:top[0],count:top[1]};break}
  }
  if(pick)break
}
if(!pick){console.log('no pick');process.exit(0)}
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1200,height:900}})
const p=await b.newPage()
await p.goto(base+'/?doc='+pick.doc.id,{waitUntil:'networkidle2'})
await p.evaluate(()=>localStorage.setItem('dt:seenWelcome','1'))
await p.reload({waitUntil:'networkidle2'});await new Promise(r=>setTimeout(r,1200))
await p.keyboard.down('Control');await p.keyboard.press('f');await p.keyboard.up('Control')
await new Promise(r=>setTimeout(r,300))
await p.keyboard.type(pick.term,{delay:20})
await new Promise(r=>setTimeout(r,1400))
const out=await p.evaluate(()=>({count:document.querySelector('#search-count').textContent,hits:document.querySelectorAll('.page .search-hit').length,current:document.querySelectorAll('.page .search-hit.current').length,activePage:document.querySelector('.search-hit')?.closest('.page')?.dataset.page}))
console.log(JSON.stringify({pick:{page:pick.page,term:pick.term,occ:pick.count},out},null,1))
await p.screenshot({path:'search-all.png'})
await b.close()
