import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
// 移除按视口宽度的换行规则
c=c.replace(/\/\* 桌面窄窗：工具栏换行[\s\S]*?\n\}\n/,'\n')
// viewer 作为容器
c=c.replace('#viewer { position: relative;','#viewer { container-type: inline-size; position: relative;')
if(!c.includes('@container (max-width: 1150px)')) {
  c += `

/* 工具栏按“文档区实际宽度”换行，而不是窗口宽度 */
@container (max-width: 1150px) {
  #toolbar {
    flex-wrap: wrap;
    height: auto;
    min-height: 54px;
    flex: 0 0 auto;
    padding: 6px 10px;
    row-gap: 6px;
    overflow: visible;
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
console.log('container toolbar ok', !c.includes('桌面窄窗：工具栏换行'))
