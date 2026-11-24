import fs from 'node:fs'
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(
`    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => resolve(null)
      r.readAsDataURL(f.blob)
    })`,
`    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }[doc.ext] || 'image/png'
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || '').replace(/^data:[^;]+/, 'data:' + mime))
      r.onerror = () => resolve(null)
      r.readAsDataURL(f.blob)
    })`
)
fs.writeFileSync('mobile/src/api.js',a)
console.log('mobile image mime ok', a.includes("data:' + mime"))
