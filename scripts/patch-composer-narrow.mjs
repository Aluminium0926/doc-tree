import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(
  "#status { color: var(--dim); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }",
  "#status { color: var(--dim); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 0; min-width: 0; }"
)
if(!c.includes('/* 输入框窄宽度')) {
  c=c.replace(
    "#composer {",
    "#composer { container-type: inline-size;"
  )
  c += `

/* 输入框窄宽度：优先保留输入和发送，状态文字不再被挤成一条线 */
@container (max-width: 460px) {
  .effort { display: none; }
}
@container (max-width: 360px) {
  #status { display: none; }
  #btn-instr { padding: 3px 7px; }
}
`
}
fs.writeFileSync('public/style.css',c)
console.log('composer narrow ok')
