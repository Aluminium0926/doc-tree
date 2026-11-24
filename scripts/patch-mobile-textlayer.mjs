import fs from 'node:fs'
let s=fs.readFileSync('mobile/src/ppt.js','utf8')
s=s.replace("import { PptxViewer } from '../vendor/pptx/renderer.js'", "import { PptxViewer, buildTextIndex } from '../vendor/pptx/renderer.js'")
s=s.replace("import { PDFDocument } from '../vendor/pptx/pdf-lib.js'", "import { PDFDocument, StandardFonts, rgb } from '../vendor/pptx/pdf-lib.js'")
s=s.replace(
  "    const pdf = await PDFDocument.create()",
  `    const pdf = await PDFDocument.create()
    const pdfFont = await pdf.embedFont(StandardFonts.Helvetica)
    const textIndex = buildTextIndex(viewer.presentationData)
    const safe = (t) => String(t || '').replace(/[^\\x20-\\x7E\\n]/g, ' ').replace(/[ \\t]{2,}/g, ' ').trim()`
)
s=s.replace(
  "      const page = pdf.addPage([w, h])\n      page.drawImage(img, { x: 0, y: 0, width: w, height: h })",
  `      const page = pdf.addPage([w, h])
      page.drawImage(img, { x: 0, y: 0, width: w, height: h })
      // 透明文本层：英文/数字可搜索、可复制，不改变画面
      for (const entry of textIndex.filter((e) => e.slideIndex === i)) {
        const txt = safe(entry.text)
        const lines = txt.split('\\n').filter(Boolean)
        if (!lines.length) continue
        const b = entry.bounds
        const size = Math.max(5, Math.min(36, (b.h / lines.length) * 0.55))
        lines.forEach((line, li) => {
          try {
            page.drawText(line, {
              x: b.x,
              y: h - b.y - size * (li + 0.9),
              size,
              font: pdfFont,
              color: rgb(0, 0, 0),
              opacity: 0
            })
          } catch {}
        })
      }`
)
fs.writeFileSync('mobile/src/ppt.js',s)
console.log('mobile text layer ok', s.includes('textIndex'))
