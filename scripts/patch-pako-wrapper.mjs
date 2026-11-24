import fs from 'node:fs'
const wrapper = "import './pako.js'\nexport default globalThis.pako\n"
fs.writeFileSync('mobile/www/vendor/pptx/pako-esm.js', wrapper)
fs.writeFileSync('ppt-lab/pako-esm.js', wrapper)
for (const f of ['mobile/www/vendor/pptx/fontkit.js','ppt-lab/fontkit.js']) {
  let s=fs.readFileSync(f,'utf8')
  s=s.replace(/from"pako"/g,'from"./pako-esm.js"')
  fs.writeFileSync(f,s)
}
console.log('pako wrapper ok', fs.readFileSync('mobile/www/vendor/pptx/fontkit.js','utf8').slice(0,60))
