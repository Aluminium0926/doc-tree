import fs from 'node:fs'
let h=fs.readFileSync('public/index.html','utf8')
h=h.replace('支持 PDF / Word / Markdown / TXT / PPT / PPTX（PPT 用本机 PowerPoint 转 PDF）','支持 PDF / Word / Markdown / TXT / PPT / 图片；图片可直接 Ctrl+V 粘贴截图')
fs.writeFileSync('public/index.html',h)
console.log('hint updated')
