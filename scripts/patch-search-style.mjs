import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('.search-hit.current')) {
  c += `
.search-hit.current { background: rgba(255, 140, 0, 0.5); outline: 2px solid #ff8c00; }
`
}
fs.writeFileSync('public/style.css',c)
console.log('current style ok')
