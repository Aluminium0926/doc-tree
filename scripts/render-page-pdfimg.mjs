import { pdf } from 'pdf-to-img'
import fs from 'node:fs'
import path from 'node:path'
try {
  const file = path.join(process.env.APPDATA, '文档树', 'files', '18e087b051a3.pdf')
  const document = await pdf(file, { scale: 1.3 })
  console.log('pages', document.length)
  const page = await document.getPage(47)
  fs.writeFileSync('page47.png', page)
  console.log('pngKB', Math.round(page.length/1024))
} catch (e) { console.error('ERR', e && (e.stack || e.message || e)) }
