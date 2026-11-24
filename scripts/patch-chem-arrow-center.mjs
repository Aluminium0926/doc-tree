import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(".chem-rxn-arrow { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 112px; color: #263140; padding: 0 5px; gap: 2px; }", ".chem-rxn-arrow { position: relative; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; align-self: stretch; min-width: 112px; color: #263140; padding: 0 5px; }")
c=c.replace(".chem-arrow-line { position: relative; display: block; width: 108px; height: 2px; background: #1f2937; margin: 3px 0; }", ".chem-arrow-line { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: block; width: 108px; height: 2px; background: #1f2937; }")
c=c.replace(".chem-arrow-line::after { content: ''; position: absolute; right: -1px; top: -5px;", ".chem-arrow-line::after { content: ''; position: absolute; right: -1px; top: -5px;")
c=c.replace(".chem-agents, .chem-cond-arrow { font-size: 13px; line-height: 1.3; color: #263140; max-width: 130px; text-align: center; overflow-wrap: anywhere; }", ".chem-agents, .chem-cond-arrow { position: absolute; left: 50%; transform: translateX(-50%); font-size: 11.5px; line-height: 1.3; color: #263140; max-width: 130px; text-align: center; overflow-wrap: anywhere; }\n.chem-agents { bottom: calc(50% + 5px); }\n.chem-cond-arrow { top: calc(50% + 5px); margin: 0; }")
fs.writeFileSync('public/style.css',c)
console.log('arrow centered to row', c.includes('top: 50%; transform: translate(-50%, -50%)'), c.includes('bottom: calc(50% + 5px)'))
