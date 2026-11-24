import fs from 'node:fs'
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync('scripts/font-test.pdf'))}).promise
const page=await doc.getPage(1);const tc=await page.getTextContent()
console.log(JSON.stringify(tc.items.map(i=>i.str).join('')))
await doc.destroy()
