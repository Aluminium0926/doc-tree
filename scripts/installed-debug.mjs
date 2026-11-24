import puppeteer from 'puppeteer-core'
try{
  const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9222',defaultViewport:null})
  const pages=await b.pages()
  console.log('pages',pages.map(p=>p.url()))
  const p=pages.find(x=>x.url().includes('43171'))||pages[0]
  const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))})
  const info=await p.evaluate(async()=>{
    const r=await fetch('/api/state');const t=await r.text()
    let j=null;try{j=JSON.parse(t)}catch{}
    return {status:r.status, docs:j?.docs?.length, groups:j?.groups?.length, raw:t.slice(0,200), domDocs:document.querySelectorAll('.doc-item').length, app:document.querySelector('#app')?.className}
  })
  console.log(JSON.stringify({info,errs},null,1))
  await b.disconnect()
}catch(e){console.error('ERR',e.message)}
