import fs from 'node:fs'
import { pdf } from 'pdf-to-img'
const doc=await pdf('scripts/lab-A.pdf',{scale:1.2})
const png=await doc.getPage(3)
fs.writeFileSync('scripts/lab-A-jpeg-page3.png',png)
console.log(png.length, doc.length)
await doc.destroy()
