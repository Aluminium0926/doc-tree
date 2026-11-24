import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const showAt = (x, y) => {\n    menu.hidden = false\n    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px'\n    menu.style.top = Math.min(y, window.innerHeight - 52) + 'px'\n  }",
  "  const showAt = (x, y) => {\n    menu.hidden = false\n    const w = menu.offsetWidth || 110\n    const h = menu.offsetHeight || 32\n    menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px'\n    menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px'\n  }"
)
fs.writeFileSync(F, t)
console.log('js patched')
