import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('/* 输入框窄窗口')) {
  c += `

/* 输入框所在右栏变窄时，优先保留操作按钮 */
@media (max-width: 980px) {
  .effort { display: none; }
}
@media (max-width: 820px) {
  #status { display: none; }
}
`
}
fs.writeFileSync('public/style.css',c)
console.log('composer narrow media ok')
