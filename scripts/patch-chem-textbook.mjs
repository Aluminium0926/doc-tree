import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')

// parseBlock: separate reagents text from conditions
j=j.replace("  let source = ''\n  let conditions = meta.condition || meta.conditions || ''", "  let source = ''\n  let conditions = meta.condition || meta.conditions || ''\n  let reagents = String(meta.reagents || meta.reagent || '').trim()")
j=j.replace(
`      let agents = String(meta.reagents || meta.reagent || '').trim()
      if (agents && !looksLikeSmiles(agents)) {
        if (!conditions) conditions = agents
        agents = ''
      }
      if (left.length && right.length) source = left.join('.') + '>' + agents + '>' + right.join('.')`,
`      let agents = ''
      if (reagents && looksLikeSmiles(reagents)) {
        agents = reagents
        reagents = ''
      }
      if (left.length && right.length) source = left.join('.') + '>' + agents + '>' + right.join('.')`
)
j=j.replace(
`          let agents = (rm?.[1] || '').trim()
          if (agents && !looksLikeSmiles(agents)) {
            if (!conditions) conditions = agents
            agents = ''
          }
          source = left.join('.') + '>' + agents + '>' + splitParts(pm[1]).join('.')`,
`          let agents = (rm?.[1] || '').trim()
          if (agents && looksLikeSmiles(agents)) {
            // keep as structural agent
          } else {
            if (!reagents) reagents = agents
            agents = ''
          }
          source = left.join('.') + '>' + agents + '>' + splitParts(pm[1]).join('.')`
)
j=j.replace(
`  return {
    source,
    label: meta.label || meta.name || '',
    conditions
  }`,
`  return {
    source,
    label: meta.label || meta.name || '',
    conditions,
    reagents
  }`
)

// drawReaction above/below labels and arrow line
j=j.replace(
`  const agents = r.agents.length && !r.conditions && r.agents.join(' · ').length <= 40 ? r.agents.join(' · ') : ''
  fig.querySelector('.chem-canvas').innerHTML = \`<div class="chem-rxn">
    <div class="chem-side">\${partsHtml(r.left, leftSvgs)}</div>
    <div class="chem-rxn-arrow">
      \${agents ? \`<span class="chem-agents">\${esc(agents)}</span>\` : ''}
      <span class="chem-arrow">→</span>
      \${r.conditions ? \`<span class="chem-cond-arrow">\${esc(r.conditions)}</span>\` : ''}
    </div>
    <div class="chem-side">\${partsHtml(r.right, rightSvgs)}</div>
  </div>\``,
`  const above = info.reagents || (r.agents.length ? r.agents.join(' · ') : '')
  const below = info.conditions || ''
  fig.querySelector('.chem-canvas').innerHTML = \`<div class="chem-rxn">
    <div class="chem-side">\${partsHtml(r.left, leftSvgs)}</div>
    <div class="chem-rxn-arrow">
      \${above ? \`<span class="chem-agents">\${esc(above)}</span>\` : ''}
      <span class="chem-arrow-line"></span>
      \${below ? \`<span class="chem-cond-arrow">\${esc(below)}</span>\` : ''}
    </div>
    <div class="chem-side">\${partsHtml(r.right, rightSvgs)}</div>
  </div>\``
)
j=j.replace("Promise.all(r.left.map((s) => moleculeSvg(s, 22))),", "Promise.all(r.left.map((s) => moleculeSvg(s, 26))),")
j=j.replace("Promise.all(r.right.map((s) => moleculeSvg(s, 22)))", "Promise.all(r.right.map((s) => moleculeSvg(s, 26)))")
fs.writeFileSync('public/chem.js',j)

// CSS arrow line
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(".chem-rxn-arrow { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; min-width: 72px; color: #263140; padding: 0 2px; }", ".chem-rxn-arrow { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 150px; color: #263140; padding: 0 6px; gap: 3px; }")
c=c.replace(".chem-arrow { font-size: 25px; line-height: 1.05; }", ".chem-arrow-line { position: relative; display: block; width: 148px; height: 2px; background: #1f2937; margin: 3px 0; }\n.chem-arrow-line::after { content: ''; position: absolute; right: -1px; top: -5px; border-left: 10px solid #1f2937; border-top: 6px solid transparent; border-bottom: 6px solid transparent; }")
c=c.replace(".chem-agents, .chem-cond-arrow { font-size: 10.5px; line-height: 1.35; color: #6b7484; max-width: 160px; text-align: center; overflow-wrap: anywhere; }", ".chem-agents, .chem-cond-arrow { font-size: 13px; line-height: 1.3; color: #263140; max-width: 170px; text-align: center; overflow-wrap: anywhere; }")
c=c.replace("@media (max-width: 640px) { .chem-rxn { justify-content: flex-start; padding-bottom: 8px; } .chem-rxn-arrow { min-width: 40px; } .chem-arrow { font-size: 19px; } .chem-cond-arrow, .chem-agents { font-size: 9px; max-width: 76px; } }", "@media (max-width: 640px) { .chem-rxn { justify-content: flex-start; padding-bottom: 8px; } .chem-rxn-arrow { min-width: 108px; } .chem-arrow-line { width: 104px; } .chem-cond-arrow, .chem-agents { font-size: 11px; max-width: 112px; } }")
fs.writeFileSync('public/style.css',c)

let ctx=fs.readFileSync('lib/context.mjs','utf8')
ctx=ctx.replace("名称用 label:，试剂/温度用 conditions:。", "名称用 label:，箭头上方试剂用 reagents:，箭头下方条件用 conditions:；副产物也要写进产物。")
fs.writeFileSync('lib/context.mjs',ctx)
console.log('textbook reaction style', j.includes('chem-arrow-line'), c.includes('.chem-arrow-line'), ctx.includes('箭头上方试剂'))
