import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace("@media (max-width: 640px) { .chem-part svg { height: 80px; max-width: 112px; } .chem-rxn-arrow { min-width: 36px; } .chem-arrow { font-size: 19px; } .chem-cond-arrow, .chem-agents { font-size: 9px; max-width: 78px; } }", "@media (max-width: 640px) { .chem-part svg { height: 80px; max-width: 112px; } .chem-rxn { flex-wrap: nowrap; justify-content: flex-start; overflow-x: auto; padding-bottom: 8px; } .chem-rxn-arrow { min-width: 42px; } .chem-arrow { font-size: 19px; } .chem-cond-arrow, .chem-agents { font-size: 9px; max-width: 78px; } }")
fs.writeFileSync('public/style.css',c)
