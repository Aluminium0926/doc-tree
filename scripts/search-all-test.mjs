import puppeteer from 'puppeteer-core'
const base='http://127.0.0.1:4317'
const st=await (await fetch(base+'/api/state')).json()
let pick=null
for(const d of st.docs.filter(x=>x.kind==='pdf'&&!x.hidden)){
  const doc=await (await fetch(base+'/api/doc/'+d.id)).json()
  for(const p of doc.doc.pages||[]){
    const m=(p.text||'').toLowerCase().match(/nervous/g)
    if(m && m.length>=2){pick={doc:d,page:p.no,count:m.length};break}
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
await p.keyboard.type('nervous',{delay:30})
await new Promise(r=>setTimeout(r,1200))
const out=await p.evaluate(()=>({
  count:document.querySelector('#search-count').textContent,
  hits:document.querySelectorAll('.page .search-hit').length,
  current:document.querySelectorAll('.page .search-hit.current').length,
  page:document.querySelector('.page[data-page]')?.dataset.page
}))
console.log(JSON.stringify({pick:{page:pick.page,occ:pick.count},out},null,1))
await p.screenshot({path:'search-all.png',clip:{x:260,y:100,width:700,height:500}})
await b.close()
