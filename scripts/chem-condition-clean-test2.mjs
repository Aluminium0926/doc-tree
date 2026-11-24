import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu']})
const p=await b.newPage();await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
const res=await p.evaluate(async()=>{
  const mod=await import('/chem.js?v=1.0.41')
  const d=document.createElement('div');d.id='chemt';document.body.append(d)
  d.innerHTML='<pre><code class="language-reaction">label: 条件测试\nreaction: CNc1ccccc1>>CN(c1ccccc1)N=O.O\nreagents: NaNO2\nconditions: pH 5–7 (aromatic amine coupling), then NaOH -> sodium salt</code></pre>'
  mod.enhanceChemBlocks(d)
  return true
})
await new Promise(r=>setTimeout(r,2500))
const out=await p.evaluate(()=>({above:document.querySelector('#chemt .chem-agents')?.textContent,below:document.querySelector('#chemt .chem-cond-arrow')?.textContent}))
console.log(out)
await b.close()

