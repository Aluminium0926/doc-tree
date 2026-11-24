import fs from 'node:fs'
import { pdf } from 'pdf-to-img'
const doc=await pdf('scripts/lab-A.pdf',{scale:1.2})
const png=await doc.getPage(1)
fs.writeFileSync('scripts/lab-A-page1.png',png)
console.log('bytes',png.length,'pages',doc.length)
await doc.destroy()
