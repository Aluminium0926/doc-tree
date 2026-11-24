import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.replaceAll("if (!pageImage && doc.kind === 'pdf')", "if (!pageImage && (doc.kind === 'pdf' || doc.kind === 'image'))")
s=s.replaceAll("if (target && target.kind === 'pdf')", "if (target && (target.kind === 'pdf' || target.kind === 'image'))")
fs.writeFileSync('server.mjs',s)
console.log('image attach patched', s.includes("doc.kind === 'image'"))
