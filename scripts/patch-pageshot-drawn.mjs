import fs from 'node:fs'
let t=fs.readFileSync('public/app.js','utf8')
t=t.replace(
  "  if (existing && existing.width > 1) return existing.toDataURL('image/png')",
  "  if (existing && existing.width > 1 && existing.closest('.page')?.dataset.drawn === '1') return existing.toDataURL('image/png')"
)
fs.writeFileSync('public/app.js',t)
console.log('drawn check ok')
