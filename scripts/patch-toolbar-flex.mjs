import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(
'#toolbar {\n  height: 54px;\n  flex: 0 0 54px;\n  display: flex;',
'#toolbar {\n  height: 54px;\n  flex: 0 0 54px;\n  display: flex;\n  overflow: hidden;'
)
c=c.replace(
'.tb-left { min-width: 0; display: flex; align-items: center; gap: 8px; }',
'.tb-left { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-width: 0; }\n#btn-sidebar { flex: 0 0 auto; }'
)
c=c.replace(
'.tb-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }',
'.tb-text { min-width: 0; max-width: min(260px, 38vw); display: flex; flex-direction: column; gap: 1px; }'
)
c=c.replace(
'.tb-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }',
'.tb-actions { display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; overflow-x: auto; justify-content: flex-end; scrollbar-width: none; }\n.tb-actions::-webkit-scrollbar { display: none; }\n.tb-actions > * { flex: 0 0 auto; }'
)
fs.writeFileSync('public/style.css',c)
console.log('toolbar flex fixed')
