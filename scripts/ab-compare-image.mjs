import fs from 'node:fs'
import { loadImage, createCanvas } from '@napi-rs/canvas'
const a=await loadImage('scripts/cmp-A0p1.png')
const b=await loadImage('scripts/cmp-B0p1.png')
const w=Math.min(a.width,b.width), h=Math.round(w*9/16)
const c=createCanvas(w*2+24,h+44);const ctx=c.getContext('2d')
ctx.fillStyle='#111';ctx.fillRect(0,0,c.width,c.height)
ctx.drawImage(a,0,40,w,h);ctx.drawImage(b,w+24,40,w,h)
ctx.fillStyle='#fff';ctx.font='20px sans-serif'
ctx.fillText('A · renderer',10,28);ctx.fillText('B · LibreOffice WASM',w+34,28)
fs.writeFileSync('scripts/ab-background-compare.png',c.toBuffer('image/png'))
console.log('saved',c.width,c.height)
