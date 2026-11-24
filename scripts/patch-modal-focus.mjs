import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
if(!a.includes('new MutationObserver')){
  a += `
// 弹窗关闭后统一恢复输入焦点（设置、欢迎页、用量、帮助等）
if (typeof MutationObserver !== 'undefined') {
  const modalWatcher = new MutationObserver(() => {
    if (!document.querySelector('.modal:not([hidden])')) setTimeout(focusComposer, 60)
  })
  document.querySelectorAll('.modal').forEach((m) => {
    modalWatcher.observe(m, { attributes: true, attributeFilter: ['hidden', 'class'] })
  })
}
`
  fs.writeFileSync('public/app.js',a)
}
let q=fs.readFileSync('public/chem.js','utf8')
// no-op; chem changes already in file
console.log('modal focus watcher', a.includes('modalWatcher'))
