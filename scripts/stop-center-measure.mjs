import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--disable-gpu'], defaultViewport:{width:1440,height:900} })
const p = await b.newPage()
await p.goto('http://127.0.0.1:4317/', { waitUntil:'networkidle2' })
await p.evaluate(()=>{ localStorage.setItem('dt:seenWelcome','1'); document.querySelector('#btn-stop').hidden = false })
await new Promise(r=>setTimeout(r,300))
const out = await p.evaluate(()=>{
  const btn = document.querySelector('#btn-stop').getBoundingClientRect()
  const svg = document.querySelector('#btn-stop svg').getBoundingClientRect()
  const rect = document.querySelector('#btn-stop svg rect').getBoundingClientRect()
  return {
    btn: {cx: btn.x+btn.width/2, cy: btn.y+btn.height/2, w: btn.width, h: btn.height},
    svg: {cx: svg.x+svg.width/2, cy: svg.y+svg.height/2, w: svg.width, h: svg.height},
    rect: {cx: rect.x+rect.width/2, cy: rect.y+rect.height/2, w: rect.width, h: rect.height},
    style: getComputedStyle(document.querySelector('#btn-stop')).padding
  }
})
console.log(JSON.stringify(out, null, 1))
await b.close()
