import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("  sc?.classList.add('is-switching')\n  if (load) load.hidden = false", "  sc?.classList.add('is-switching')\n  $('#tree')?.classList.add('is-switching')\n  if (load) load.hidden = false")
a=a.replace("  sc?.classList.remove('is-switching')\n  if (load) load.hidden = true", "  sc?.classList.remove('is-switching')\n  $('#tree')?.classList.remove('is-switching')\n  if (load) load.hidden = true")
fs.writeFileSync('public/app.js',a)
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('#tree.is-switching')){
  c += `\n#tree.is-switching { visibility: hidden; }\n`
  fs.writeFileSync('public/style.css',c)
}
console.log('tree hide patch', a.includes("$('#tree')?.classList.add('is-switching')"))
