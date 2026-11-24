import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu']})
const p=await b.newPage();await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
const r=await p.evaluate(async()=>{
  await new Promise((res,rej)=>{const s=document.createElement('script');s.src='/vendor/rdkit/RDKit_minimal.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})
  const rd=await initRDKitModule({locateFile:f=>'/vendor/rdkit/'+f})
  const out={}
  for(const smi of ['CC(=O)OCC','CCO','CC(=O)Cl']){const m=rd.get_mol(smi);out[smi]=m.get_svg(300,180);m.delete()}
  const rx=rd.get_rxn('CC(=O)Cl.OCC>>CC(=O)OCC');out.rxn=rx.get_svg(800,240);rx.delete()
  return out
})
import fs from 'node:fs'
for(const [k,v] of Object.entries(r)){fs.writeFileSync('scripts/chem-'+k.replace(/[^a-z0-9]/gi,'_')+'.svg',v)}
console.log(Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.length])))
await b.close()
