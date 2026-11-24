import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(".chem-rxn-arrow > span { display: block; }", ".chem-rxn-arrow > .chem-agents, .chem-rxn-arrow > .chem-cond-arrow { position: absolute; left: 50%; transform: translateX(-50%); display: block; }")
c=c.replace(".chem-cond-arrow { margin-top: 1px; }", ".chem-agents { bottom: calc(50% + 6px); }\n.chem-cond-arrow { top: calc(50% + 6px); margin: 0; }")
fs.writeFileSync('public/style.css',c)
console.log('labels absolute', c.includes('bottom: calc(50% + 6px)'), c.includes('top: calc(50% + 6px)'))
