import fs from 'node:fs'
let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('.chem-rxn')){
  c += `
.chem-rxn { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; width: 100%; padding: 12px 4px; }
.chem-side { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; }
.chem-part svg { height: 132px; width: auto; max-width: 220px; display: block; }
.chem-plus { font-size: 18px; color: #556070; margin: 0 2px; }
.chem-rxn-arrow { display: flex; flex-direction: column; align-items: center; min-width: 86px; color: #263140; padding: 0 2px; }
.chem-arrow { font-size: 25px; line-height: 1.05; }
.chem-agents, .chem-cond-arrow { font-size: 10.5px; line-height: 1.35; color: #6b7484; max-width: 160px; text-align: center; overflow-wrap: anywhere; }
.chem-cond-arrow { margin-top: 1px; }
@media (max-width: 640px) { .chem-part svg { height: 108px; max-width: 170px; } .chem-rxn-arrow { min-width: 64px; } }
`
  fs.writeFileSync('public/style.css',c)
}
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace("  if (info.conditions) {\n    const c = document.createElement('span')\n    c.className = 'chem-cond'\n    c.textContent = info.conditions\n    cap.appendChild(c)\n  }", "  if (info.conditions && kind !== 'reaction') {\n    const c = document.createElement('span')\n    c.className = 'chem-cond'\n    c.textContent = info.conditions\n    cap.appendChild(c)\n  }")
j=j.replace("      const agents = r.agents.length ? r.agents.join(' · ') : ''", "      const agents = r.agents.length && !r.conditions && r.agents.join(' · ').length <= 40 ? r.agents.join(' · ') : ''")
fs.writeFileSync('public/chem.js',j)
console.log('chem rxn css/patch ok')
