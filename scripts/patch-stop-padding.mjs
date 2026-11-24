import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `  display: grid; place-items: center; line-height: 0;
  flex: 0 0 auto;
}`,
  `  display: grid; place-items: center; line-height: 0;
  padding: 0; margin: 0; box-sizing: border-box;
  flex: 0 0 auto;
}`
)
fs.writeFileSync(F, t)
console.log('stop padding reset')
