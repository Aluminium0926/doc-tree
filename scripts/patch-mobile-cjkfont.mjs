import fs from 'node:fs'
let s=fs.readFileSync('mobile/src/ppt.js','utf8')
s=s.replace("import { PDFDocument, StandardFonts, rgb } from '../vendor/pptx/pdf-lib.js'", "import { PDFDocument, rgb } from '../vendor/pptx/pdf-lib.js'\nimport fontkit from '../vendor/pptx/fontkit.js'")
s=s.replace(
`    const pdf = await PDFDocument.create()
    const pdfFont = await pdf.embedFont(StandardFonts.Helvetica)
    const textIndex = buildTextIndex(viewer.presentationData)
    const safe = (t) => String(t || '').replace(/[^\\x20-\\x7E\\n]/g, ' ').replace(/[ \\t]{2,}/g, ' ').trim()`,
`    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    const fontBytes = await fetch(new URL('../vendor/pptx/NotoSansSC.woff2', import.meta.url)).then((r) => r.arrayBuffer())
    const pdfFont = await pdf.embedFont(fontBytes, { subset: true })
    const textIndex = buildTextIndex(viewer.presentationData)
    const safe = (t) => String(t || '').replace(/[\\u0000-\\u0008\\u000B-\\u001F]/g, ' ').replace(/[ \\t]{2,}/g, ' ').trim()`
)
fs.writeFileSync('mobile/src/ppt.js',s)
console.log('mobile CJK font ok', s.includes('fontkit'))
