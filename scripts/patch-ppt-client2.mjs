import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("if (!/\\.(pdf|docx?|md|markdown|txt|pptx)$/.test(ext)) {", "if (!/\\.(pdf|docx?|md|markdown|txt|pptx?)$/.test(ext)) {")
fs.writeFileSync('public/app.js',a)
let h=fs.readFileSync('public/index.html','utf8')
h=h.replace('accept=".pdf,.docx,.md,.markdown,.txt,.pptx"','accept=".pdf,.docx,.md,.markdown,.txt,.ppt,.pptx"')
h=h.replace('支持 PDF / Word / Markdown / TXT / PPTX','支持 PDF / Word / Markdown / TXT / PPT / PPTX（PPT 用本机 PowerPoint 转 PDF）')
fs.writeFileSync('public/index.html',h)
console.log('client ppt allow ok')
