import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
const needle="    await store.saveDoc(doc)\n\n    // 后台生成摘要，不阻塞响应"
const repl=`    await store.saveDoc(doc)

    if (kind === 'image') {
      try {
        const dataUrl = await renderPageImage(doc, 1)
        const text = await llm.ocrImage(dataUrl)
        if (text) {
          doc.pages[0].text = text
          doc.ocr = true
          await store.saveDoc(doc)
        }
      } catch (e) {
        console.warn('[ocr] failed:', e.message)
      }
    }

    // 后台生成摘要，不阻塞响应`
if(!s.includes(needle)) throw new Error('import needle')
s=s.replace(needle,repl)
fs.writeFileSync('server.mjs',s)
console.log('server OCR import ok')
