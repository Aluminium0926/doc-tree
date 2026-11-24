import fs from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
try{
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit)
  const font=await pdf.embedFont(fs.readFileSync('scripts/NotoSansSC.woff2'),{subset:true})
  const page=pdf.addPage([300,100]);page.drawText('中文测试 Cancer',{x:10,y:40,size:20,font})
  const out=await pdf.save();fs.writeFileSync('scripts/font-test.pdf',out);console.log('ok',out.length)
}catch(e){console.error('ERR',e.message)}
