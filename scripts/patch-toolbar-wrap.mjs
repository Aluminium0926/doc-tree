import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('/* 桌面窄窗：工具栏换行')) {
  c += `

/* 桌面窄窗：工具栏换行，避免功能被裁掉 */
@media (min-width: 901px) and (max-width: 1100px) {
  #toolbar {
    flex-wrap: wrap;
    height: auto;
    min-height: 54px;
    flex: 0 0 auto;
    padding: 6px 10px;
    row-gap: 6px;
  }
  .tb-left { flex: 1 1 100%; }
  .tb-actions {
    flex: 1 1 100%;
    overflow: visible;
    justify-content: flex-start;
    flex-wrap: wrap;
    row-gap: 6px;
  }
  .tool-group { display: flex; }
  #btn-theme, #btn-rotate { display: grid; }
}
`
}
fs.writeFileSync('public/style.css',c)
console.log('toolbar wrap ok')
