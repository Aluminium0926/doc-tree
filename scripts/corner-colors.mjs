import fs from 'node:fs'
import { pdf } from 'pdf-to-img'
import { loadImage, createCanvas } from '@napi-rs/canvas'
for (const m of ['A','B']) {
  const d=await pdf(`scripts/lab-batch/${m}-0.pdf`,{scale:0.5})
  const cols=[]
  for(let i=1;i<=d.length;i++){
    const buf=await d.getPage(i)
    const img=await loadImage(buf)
    const c=createCanvas(10,10);const ctx=c.getContext('2d');ctx.drawImage(img,0,0,10,10)
    const p=ctx.getImageData(2,2,1,1).data
    cols.push(`${i}:${p[0]},${p[1]},${p[2]}`)
  }
  console.log(m, cols.join(' | '))
  await d.destroy()
}
