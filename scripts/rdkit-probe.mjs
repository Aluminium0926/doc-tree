import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu']})
const p=await b.newPage();p.on('console',m=>{if(m.type()==='error')console.log('ERR',m.text().slice(0,200))})
await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
const res=await p.evaluate(async()=>{
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/rdkit/RDKit_minimal.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})
  const rdkit=await initRDKitModule({locateFile:(f)=>'/vendor/rdkit/'+f})
  const mol=rdkit.get_mol('c1ccccc1')
  const svg=mol.get_svg(300,200);mol.delete()
  const rxn=rdkit.get_rxn('CC(=O)Cl.OCC>>CC(=O)OCC')
  const rsvg=rxn.get_svg(700,220);rxn.delete()
  return {molecule:svg.slice(0,120),reaction:rsvg.slice(0,200),molLen:svg.length,rxnLen:rsvg.length}
})
console.log(res)
await b.close()
