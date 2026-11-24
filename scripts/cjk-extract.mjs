import fs from 'node:fs'
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('scripts/lab-CJK.pdf'))}).promise
console.log('pages',doc.numPages)
for(const n of [1,2]){const page=await doc.getPage(n);const tc=await page.getTextContent();console.log('p'+n,JSON.stringify(tc.items.map(i=>i.str).join(' ').slice(0,400)))}
await doc.destroy()
