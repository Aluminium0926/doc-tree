import { pdf } from 'pdf-to-img'
for(let i=0;i<4;i++){
  for(const m of ['A','B']){
    const f=`scripts/lab-batch/${m}-${i}.pdf`
    try{const d=await pdf(f,{scale:0.3});console.log(m,i,'pages',d.length);await d.destroy()}catch(e){console.log(m,i,'ERR',e.message)}
  }
}
