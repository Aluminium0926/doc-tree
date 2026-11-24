import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(
  "    const ext = (name.match(/\\.[^.]+$/) || [''])[0].toLowerCase()\n    // pdf.js",
  "    const ext = (name.match(/\\.[^.]+$/) || [''])[0].toLowerCase()\n    if (!['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx'].includes(ext)) {\n      return json({ error: `暂不支持 ${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX` }, 415)\n    }\n    // pdf.js"
)
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile import guard ok')
