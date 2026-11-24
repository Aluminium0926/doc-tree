import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
if(!j.includes('chem-timeout')){
  j=j.replace(
`    const { fig, info } = makeFigure(lang, raw)
    pre.replaceWith(fig)
    enqueue(() => draw(fig, lang, info))`,
`    const { fig, info } = makeFigure(lang, raw)
    pre.replaceWith(fig)
    setTimeout(() => {
      if (!fig.isConnected) return
      if (fig.dataset.state === 'done' || fig.dataset.state === 'error') return
      fig.dataset.state = 'error'
      const c = fig.querySelector('.chem-canvas')
      if (!c) return
      c.textContent = ''
      const e = document.createElement('div')
      e.className = 'chem-error'
      e.textContent = '结构渲染超时，请刷新后重试'
      const p = document.createElement('pre')
      p.textContent = info.source
      c.append(e, p)
    }, 15000)
    enqueue(() => draw(fig, lang, info))`
  )
  fs.writeFileSync('public/chem.js',j)
}
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(".chem-canvas pre { width: 100%; margin: 0; padding: 10px 14px; background: #f6f7fb; color: #333; font-size: 11px; overflow: auto; }", ".chem-canvas pre { width: 100%; margin: 0; padding: 10px 14px; background: #f6f7fb; color: #333; font-size: 11px; overflow: auto; white-space: pre-wrap; word-break: break-all; }")
fs.writeFileSync('public/style.css',c)
console.log('chem watchdog/css', j.includes('chem-timeout'), c.includes('word-break'))
