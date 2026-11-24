import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("import { PDFDocument } from '/node_modules/pdf-lib/dist/pdf-lib.esm.js'", "import { PDFDocument, StandardFonts } from '/node_modules/pdf-lib/dist/pdf-lib.esm.js'")
if(!s.includes('pdfSafeText')){
  s=s.replace(
    "    const pdf = await PDFDocument.create()",
    `    const pdf = await PDFDocument.create()
    const pdfFont = await pdf.embedFont(StandardFonts.Helvetica)
    const pdfSafeText = (t) => String(t || '').replace(/[^\\x20-\\x7E\\n]/g, ' ').replace(/[ \\t]{2,}/g, ' ').trim()
    const textIndex = buildTextIndex(viewer.presentationData)`
  )
  s=s.replace(
    "      const page = pdf.addPage([w, h])\n      page.drawImage(img, { x: 0, y: 0, width: w, height: h })",
    `      const page = pdf.addPage([w, h])
      page.drawImage(img, { x: 0, y: 0, width: w, height: h })
      // 透明文本层：可搜索/可复制，但不影响画面
      for (const entry of textIndex.filter((e) => e.slideIndex === i)) {
        const txt = pdfSafeText(entry.text)
        if (!txt) continue
        const lines = txt.split('\\n').filter(Boolean)
        if (!lines.length) continue
        const b = entry.bounds
        const size = Math.max(5, Math.min(36, (b.h / lines.length) * 0.55))
        lines.forEach((line, li) => {
          const yLine = h - b.y - size * (li + 0.9)
          try {
            page.drawText(line, { x: b.x, y: yLine, size, font: pdfFont, color: rgb(0, 0, 0), opacity: 0 })
          } catch {}
        })
      }`
  )
  s=s.replace("import { PDFDocument, StandardFonts } from", "import { PDFDocument, StandardFonts, rgb } from")
}
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('text layer added', s.includes('pdfSafeText'))
