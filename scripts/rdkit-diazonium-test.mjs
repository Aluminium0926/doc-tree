import puppeteer from 'puppeteer-core'
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--disable-gpu']})
const p=await b.newPage();await p.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle2'})
const out=await p.evaluate(async()=>{
 await new Promise((res,rej)=>{const s=document.createElement('script');s.src='/vendor/rdkit/RDKit_minimal.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})
 const rd=await initRDKitModule({locateFile:f=>'/vendor/rdkit/'+f})
 const tests=['[N+]#Nc1ccccc1','[N+]#N-c1ccccc1','N#[N+]c1ccccc1','[N-]=[N+]-c1ccccc1','[Cl-]','[N+]#Nc1ccccc1.Cl']
 const r={}
 for(const s of tests){let m;try{m=rd.get_mol(s)}catch(e){r[s]='throw '+e.message;continue};r[s]=m?('ok '+m.get_smiles()):'null';if(m)m.delete()}
 return r
})
console.log(JSON.stringify(out,null,1))
await b.close()
