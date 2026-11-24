import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace('@media (min-width: 901px) and (max-width: 1100px) {','@media (min-width: 761px) and (max-width: 1100px) {')
fs.writeFileSync('public/style.css',c)
console.log('wrap range fixed')
