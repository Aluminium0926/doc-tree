import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
`async function importFiles(files) {
  for (const f of files) {
    setStatus(\`解析中：\${f.name}\`)
    try {`,
`async function importFiles(files) {
  for (const f of files) {
    const ext = (f.name.match(/\\.[^.]+$/) || [''])[0].toLowerCase()
    if (!/\\.(pdf|docx?|md|markdown|txt|pptx)$/.test(ext)) {
      toast(\`暂不支持 \${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX\`)
      continue
    }
    if (f.size > 150 * 1024 * 1024) {
      toast('文件超过 150MB，建议先压缩或导出成 PDF')
      continue
    }
    setStatus(\`解析中：\${f.name}\`)
    try {`
)
fs.writeFileSync('public/app.js',a)

let h=fs.readFileSync('public/index.html','utf8')
h=h.replace('accept=".pdf,.docx,.md,.markdown,.txt"','accept=".pdf,.docx,.md,.markdown,.txt,.pptx"')
h=h.replace('支持 PDF / Word / Markdown / TXT','支持 PDF / Word / Markdown / TXT / PPTX')
fs.writeFileSync('public/index.html',h)
console.log('client guard ok')
