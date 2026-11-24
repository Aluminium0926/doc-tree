import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace('#composer { container-type: inline-size;','#composer {')
c=c.replace(/\n\/\* 输入框窄宽度[\s\S]*?@container \(max-width: 360px\) \{[\s\S]*?\n\}\n/,'\n')
fs.writeFileSync('public/style.css',c)
console.log('container removed', !c.includes('container-type'), !c.includes('@container'))
