import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('/* 窄窗口工具栏')) {
  c += `

/* 窄窗口工具栏：保证缩放/页码/搜索先可见，非核心工具收起 */
@media (max-width: 1180px) {
  .tb-actions { justify-content: flex-start; }
}
@media (max-width: 1000px) {
  .tool-group { display: none; }
  #btn-theme, #btn-rotate { display: none; }
}
@media (max-width: 760px) {
  #btn-shot { display: none; }
}
`
}
fs.writeFileSync('public/style.css',c)
console.log('toolbar narrow rules ok')
