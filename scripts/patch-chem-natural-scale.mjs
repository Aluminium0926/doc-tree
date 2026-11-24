import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(".chem-part svg { height: 100px; width: auto; max-width: 150px; display: block; }", ".chem-part svg { width: auto; height: auto; max-width: none; display: block; }")
c=c.replace("@media (max-width: 640px) { .chem-part svg { height: 78px; max-width: 108px; } .chem-rxn { justify-content: flex-start; padding-bottom: 8px; } .chem-rxn-arrow { min-width: 40px; } .chem-arrow { font-size: 19px; } .chem-cond-arrow, .chem-agents { font-size: 9px; max-width: 76px; } }", "@media (max-width: 640px) { .chem-rxn { justify-content: flex-start; padding-bottom: 8px; } .chem-rxn-arrow { min-width: 40px; } .chem-arrow { font-size: 19px; } .chem-cond-arrow, .chem-agents { font-size: 9px; max-width: 76px; } }")
fs.writeFileSync('public/style.css',c)
console.log('natural scaling css', c.includes('.chem-part svg { width: auto; height: auto;'))
