import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu']})
const p=await b.newPage();await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
const out=await p.evaluate(async()=>{
 await new Promise((res,rej)=>{const s=document.createElement('script');s.src='/vendor/rdkit/RDKit_minimal.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})
 const rd=await initRDKitModule({locateFile:f=>'/vendor/rdkit/'+f})
 const r={}
 for(const smi of ['c1ccccc1','CC(=O)OCC','CN(C)c1ccc(/N=N/c2ccccc2)cc1']){
  const m=rd.get_mol(smi)
  const plain=m.get_svg(360,260)
  const fixed=m.get_svg_with_highlights(JSON.stringify({width:360,height:260,fixedBondLength:24}))
  const d=(s)=>[...s.matchAll(/class='bond-[^']+' d='([^']+)'/g)].slice(0,3).map(x=>x[1])
  r[smi]={plain:d(plain),fixed:d(fixed)}
  m.delete()
 }
 return r
})
console.log(JSON.stringify(out,null,1))
await b.close()
