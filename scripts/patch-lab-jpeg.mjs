import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace("import { domToPng } from '/node_modules/modern-screenshot/dist/index.mjs'", "import { domToJpeg } from '/node_modules/modern-screenshot/dist/index.mjs'")
s=s.replace(
`      const dataUrl = await domToPng(holder, {
        width: w,
        height: h,
        scale: 1.4,
        backgroundColor: '#ffffff'
      })
      const png = await fetch(dataUrl).then((r) => r.arrayBuffer())
      const img = await pdf.embedPng(png)`,
`      const dataUrl = await domToJpeg(holder, {
        width: w,
        height: h,
        scale: 1.3,
        quality: 0.9,
        backgroundColor: '#ffffff'
      })
      const jpg = await fetch(dataUrl).then((r) => r.arrayBuffer())
      const img = await pdf.embedJpg(jpg)`
)
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('A jpeg ok')
