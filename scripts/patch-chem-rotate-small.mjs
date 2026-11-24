import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
if(!j.includes('function principalAngleDeg')){
  j=j.replace("function cropMoleculeSvg(svg) {", `function principalAngleDeg(molblock) {
  try {
    const lines = String(molblock || '').split(/\\r?\\n/)
    if (lines.length < 5) return 0
    const counts = lines[3].trim().split(/\\s+/)
    const n = Number(counts[0])
    if (!n) return 0
    const pts = []
    for (let i = 0; i < n; i++) {
      const p = lines[4 + i].trim().split(/\\s+/)
      const x = Number(p[0])
      const y = Number(p[1])
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
    }
    if (pts.length < 3) return 0
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
    let sxx = 0
    let syy = 0
    let sxy = 0
    for (const [x, y] of pts) {
      const dx = x - mx
      const dy = y - my
      sxx += dx * dx
      syy += dy * dy
      sxy += dx * dy
    }
    const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const deg = (angle * 180) / Math.PI
    return Number.isFinite(deg) ? Math.max(-90, Math.min(90, deg)) : 0
  } catch {
    return 0
  }
}

function cropMoleculeSvg(svg) {`)
}
j=j.replace("async function moleculeSvg(source, bond = 22) {", "async function moleculeSvg(source, bond = 18) {")
j=j.replace("  const raw = mol.get_svg_with_highlights(\n    JSON.stringify({ width: 900, height: 700, fixedBondLength: bond })\n  )", "  let angle = 0\n  try {\n    angle = principalAngleDeg(mol.get_molblock())\n  } catch {}\n  const raw = mol.get_svg_with_highlights(\n    JSON.stringify({ width: 900, height: 700, fixedBondLength: bond, rotate: -angle })\n  )")
j=j.replace("moleculeSvg(s, 26)", "moleculeSvg(s, 18)")
j=j.replace("moleculeSvg(info.source, 42)", "moleculeSvg(info.source, 30)")
fs.writeFileSync('public/chem.js',j)
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace("min-width: 150px; color: #263140; padding: 0 6px; gap: 3px;", "min-width: 112px; color: #263140; padding: 0 5px; gap: 2px;")
c=c.replace(".chem-arrow-line { position: relative; display: block; width: 148px; height: 2px;", ".chem-arrow-line { position: relative; display: block; width: 108px; height: 2px;")
c=c.replace(".chem-agents, .chem-cond-arrow { font-size: 13px; line-height: 1.3; color: #263140; max-width: 170px;", ".chem-agents, .chem-cond-arrow { font-size: 11.5px; line-height: 1.3; color: #263140; max-width: 130px;")
c=c.replace(".chem-rxn-arrow { min-width: 108px; } .chem-arrow-line { width: 104px; }", ".chem-rxn-arrow { min-width: 84px; } .chem-arrow-line { width: 82px; }")
fs.writeFileSync('public/style.css',c)
console.log('rotate+small', j.includes('principalAngleDeg'), j.includes('rotate: -angle'), j.includes('moleculeSvg(s, 18)'))
