import fs from 'node:fs'
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('scripts/lab-A.pdf'))}).promise
for(const n of [1,3]){
  const page=await doc.getPage(n); const tc=await page.getTextContent()
  console.log('page',n,JSON.stringify(tc.items.map(i=>i.str).join(' ').slice(0,300)))
}
await doc.destroy()
