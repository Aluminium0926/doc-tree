import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
const old=`    // 没有文字层的页（扫描件）：直接把这一页的渲染图交给视觉模型
    const page = (S.doc.pages || []).find((p) => p.no === pageNo)
    const text = (page?.text || '').trim()
    if (text.length < 20) {
      const cv = document.querySelector(\`.page[data-page="\${pageNo}"] canvas\`)
      if (cv) {
        try {
          S.pendingShot = cv.toDataURL('image/jpeg', 0.85)
        } catch {}
      }
    }
    send('讲解本页内容')`
const repl=`    // 讲解整页时始终带上这一页的渲染图：文字层经常漏掉图片、公式和表格
    const cv = document.querySelector(\`.page[data-page="\${pageNo}"] canvas\`)
    if (cv) {
      try {
        S.pendingShot = cv.toDataURL('image/jpeg', 0.9)
      } catch {}
    }
    send('讲解本页内容')`
if(!a.includes(old)) throw new Error('page menu block not found')
a=a.replace(old,repl)
fs.writeFileSync('public/app.js',a)
console.log('explain page always attaches image', a.includes('讲解整页时始终带上'))
