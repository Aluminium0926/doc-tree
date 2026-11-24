import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('.chem-part-error')){
  c += `\n.chem-part-error { display: inline-block; padding: 8px 10px; border: 1px dashed #e2b8b3; border-radius: 8px; background: #fff8f7; color: #b42318; font-size: 10.5px; line-height: 1.35; max-width: 150px; white-space: normal; }\n`
  fs.writeFileSync('public/style.css',c)
}
console.log('badge css', c.includes('.chem-part-error'))
