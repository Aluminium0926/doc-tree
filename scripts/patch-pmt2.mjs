import fs from 'node:fs'
const F = 'scripts/page-menu-test2.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("reqHasPage2: seen.some(s => /第 ?2 ?页/.test(s))", "reqHasPage2: seen.some(s => s.includes('第 2 页，本页内容')), reqHasAsk: seen.some(s => s.includes('请讲解第 2 页'))")
fs.writeFileSync(F, t)
console.log('ok')
