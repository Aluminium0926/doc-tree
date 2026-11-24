import fs from 'node:fs'
const V='4.10.38'
let w=`// pdf.js worker entry: polyfill + worker, pinned to the same version\nimport './pdf-worker-polyfill.mjs?v=${V}'\nimport './pdf.worker.min.mjs?v=${V}'\n`
fs.writeFileSync('public/vendor/pdf.worker.wrapper.mjs',w)
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("S.pdfjs ??= await import(VENDOR + 'pdf.min.mjs')\n  S.pdfjs.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs'", "S.pdfjs ??= await import(VENDOR + 'pdf.min.mjs?v=4.10.38')\n  S.pdfjs.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs?v=4.10.38'")
fs.writeFileSync('public/app.js',a)
let e=fs.readFileSync('mobile/src/extract.js','utf8')
e=e.replace("import(VENDOR + 'pdf.min.mjs')", "import(VENDOR + 'pdf.min.mjs?v=4.10.38')")
e=e.replace("m.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs'", "m.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.wrapper.mjs?v=4.10.38'")
fs.writeFileSync('mobile/src/extract.js',e)
console.log('pdf version pin ok', a.includes('pdf.min.mjs?v=4.10.38'), e.includes('pdf.worker.wrapper.mjs?v=4.10.38'))
