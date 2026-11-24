import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("import { PDFDocument, StandardFonts, rgb } from '/node_modules/pdf-lib/dist/pdf-lib.esm.js'", "import { PDFDocument, rgb } from '/node_modules/pdf-lib/dist/pdf-lib.esm.js'\nimport fontkit from './fontkit.js'")
s=s.replace(
`    const pdf = await PDFDocument.create()
    const pdfFont = await pdf.embedFont(StandardFonts.Helvetica)
    const pdfSafeText = (t) => String(t || '').replace(/[^\\x20-\\x7E\\n]/g, ' ').replace(/[ \\t]{2,}/g, ' ').trim()`,
`    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    const fontBytes = await fetch('./NotoSansSC.woff2').then((r) => r.arrayBuffer())
    const pdfFont = await pdf.embedFont(fontBytes, { subset: true })
    const pdfSafeText = (t) => String(t || '').replace(/[\\u0000-\\u0008\\u000B-\\u001F]/g, ' ').replace(/[ \\t]{2,}/g, ' ').trim()`
)
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('lab CJK font ok', s.includes('fontkit'))
