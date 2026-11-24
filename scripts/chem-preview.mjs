import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const files=['chem-CCO.svg','chem-CC__O_Cl.svg','chem-CC__O_OCC.svg','chem-rxn.svg']
const html='<body style="background:#fff;margin:0">'+files.map(f=>`<div style="border-bottom:1px solid #ddd;padding:8px">${fs.readFileSync('scripts/'+f,'utf8')}</div>`).join('')+'</body>'
fs.writeFileSync('scripts/chem-preview.html',html)
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1000,height:1200}})
const p=await b.newPage();await p.goto('http://127.0.0.1:4317/scripts/chem-preview.html',{waitUntil:'networkidle2'})
await p.screenshot({path:'chem-preview.png',fullPage:true})
await b.close()
