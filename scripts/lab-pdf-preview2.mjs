import fs from 'node:fs'
import { pdf } from 'pdf-to-img'
for (const [inp,out] of [['scripts/lab-B.pdf','scripts/lab-B-page1.png'],['scripts/lab-A.pdf','scripts/lab-A-page3.png']]) {
  const doc=await pdf(inp,{scale:1.2})
  const idx = inp.includes('lab-A') ? 3 : 1
  const png = await doc.getPage(idx)
  fs.writeFileSync(out,png)
  console.log(out, png.length, 'pages', doc.length)
  await doc.destroy()
}
