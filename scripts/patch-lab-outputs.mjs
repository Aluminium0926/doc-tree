import fs from 'node:fs'
let s=fs.readFileSync('ppt-lab/lab.js','utf8')
s=s.replace(
  "    const bytes = await pdf.save()",
  "    const bytes = await pdf.save()\n    window.__lastA = { name: file.name.replace(/\\.[^.]+$/, '') + '-A.pdf', b64: btoa(Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join('')) }"
)
s=s.replace(
  "    const blob = new Blob([result.data], { type: 'application/pdf' })",
  "    window.__lastB = { name: file.name.replace(/\\.[^.]+$/, '') + '-B.pdf', b64: btoa(Array.from(new Uint8Array(result.data), b => String.fromCharCode(b)).join('')) }\n    const blob = new Blob([result.data], { type: 'application/pdf' })"
)
fs.writeFileSync('ppt-lab/lab.js',s)
console.log('expose outputs ok')
