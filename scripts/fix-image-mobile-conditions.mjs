import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replaceAll("if (!pageImage && doc.kind === 'pdf')", "if (!pageImage && (doc.kind === 'pdf' || doc.kind === 'image'))")
a=a.replace(
`  if (doc.kind === 'pdf') {
    try {`,
`  if (doc.kind === 'pdf' || doc.kind === 'image') {
    try {`
)
a=a.replace(
"    resumeImage = await globalThis.__dtPageImage?.(node.anchor?.page || 1)",
"    resumeImage = doc.kind === 'image' ? await imageDocDataUrl(doc) : await globalThis.__dtPageImage?.(node.anchor?.page || 1)"
)
a=a.replace(
"async function makeSummary(doc) {\n  try {",
"async function makeSummary(doc) {\n  if (doc.kind === 'image') return\n  try {"
)
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile conditions', a.includes("doc.kind === 'pdf' || doc.kind === 'image'"))
