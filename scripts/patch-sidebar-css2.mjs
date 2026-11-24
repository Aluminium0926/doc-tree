import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(/@media \(min-width: 901px\) \{\r?\n  #app\.collapsed \{[\s\S]*?\n\}\r?\n/, `#app.collapsed { grid-template-columns: 0 minmax(0, 1fr) var(--right, 460px); }
#app.collapsed #resizer-left { display: none; }
#app.collapsed #library { padding: 0; border: 0; overflow: hidden; visibility: hidden; }
#app.collapsed #library > * { display: none; }
`)
c=c.replace(/\r?\n@media \(max-width: 900px\) \{ #btn-sidebar \{ display: none; \} \}\r?\n/, '\n')
fs.writeFileSync('public/style.css',c)
console.log('css collapsed fixed:', !c.includes('@media (min-width: 901px)'), !c.includes('#btn-sidebar { display: none; }'))
