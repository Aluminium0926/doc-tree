import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu'],defaultViewport:{width:1000,height:1200}})
const p=await b.newPage();await p.goto('http://127.0.0.1:4317/test-chem.html',{waitUntil:'networkidle2'})
await p.screenshot({path:'chem-preview.png',fullPage:true})
await b.close()
