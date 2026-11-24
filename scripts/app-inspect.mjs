import puppeteer from 'puppeteer-core'
const b=await puppeteer.connect({browserURL:'http://127.0.0.1:9222',defaultViewport:null})
const pages=await b.pages()
console.log('pages',pages.map(p=>p.url()))
const p=pages.find(x=>x.url().includes('43171'))||pages[0]
const logs=[]
p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,300)))
p.on('pageerror',e=>logs.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').slice(0,500)))
const info=await p.evaluate(async()=>{
  let state=null, stText=''
  try{const r=await fetch('/api/state');stText=await r.text();state=JSON.parse(stText)}catch(e){stText='ERR '+e.message}
  return {
    url:location.href,
    appClass:document.querySelector('#app')?.className,
    docListChildren:document.querySelector('#doc-list')?.children.length,
    docItems:document.querySelectorAll('.doc-item').length,
    libText:document.querySelector('#library')?.innerText.slice(0,200),
    stateDocs:state?.docs?.length, stateGroups:state?.groups?.length,
    stateErr:state?null:stText.slice(0,200),
    uiVersion:window.__DT_UI||null,
    ls:{left:localStorage.getItem('dt:left'),last:localStorage.getItem('dt:last'),seen:localStorage.getItem('dt:seenWelcome')}
  }
})
console.log(JSON.stringify(info,null,1))
console.log('LOGS',logs.slice(-30).join('\n'))
await b.disconnect()
