import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(
`@media (min-width: 901px) {
  #app.collapsed { grid-template-columns: 0 minmax(0, 1fr) var(--right, 460px); }
  #app.collapsed #resizer-left { display: none; }
  #app.collapsed #library { padding: 0; border: 0; overflow: hidden; visibility: hidden; }
  #app.collapsed #library > * { display: none; }
}`,
`#app.collapsed { grid-template-columns: 0 minmax(0, 1fr) var(--right, 460px); }
#app.collapsed #resizer-left { display: none; }
#app.collapsed #library { padding: 0; border: 0; overflow: hidden; visibility: hidden; }
#app.collapsed #library > * { display: none; }`
)
c=c.replace('@media (max-width: 900px) { #btn-sidebar { display: none; } }\n','')
fs.writeFileSync('public/style.css',c)

let m=fs.readFileSync('mobile/mobile.css','utf8')
m=m.replace(
  '  #btn-mobile-lib {',
  '  #btn-sidebar { display: none; }\n  #btn-mobile-lib {'
)
fs.writeFileSync('mobile/mobile.css',m)

let a=fs.readFileSync('public/app.js','utf8')
a=a.replace(
  "  setLeftCollapsed(localStorage.getItem('dt:left') === '1', false)",
  "  const savedLeft = localStorage.getItem('dt:left')\n  // 窄窗口首次打开时默认收起左栏，避免一进来就三栏挤在一起；用户手动展开后会记住\n  if (savedLeft === null && window.innerWidth < 980) setLeftCollapsed(true, false)\n  else setLeftCollapsed(savedLeft === '1', false)"
)
fs.writeFileSync('public/app.js',a)
console.log('sidebar responsive fix ok')
