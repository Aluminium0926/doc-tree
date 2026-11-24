import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
const start=j.indexOf('async function moleculeSvg(source, bond = 18) {')
const end=j.indexOf('function fitMolecule',start)
if(start<0||end<0) throw new Error('molecule block')
const block=`async function moleculeSvg(source, bond = 18) {
  const key = bond + ':' + source
  if (molCache.has(key)) return molCache.get(key)
  const rdkit = await getRDKit()
  const mol = rdkit.get_mol(source)
  if (!mol) throw new Error('SMILES 无法解析：' + source.slice(0, 60))
  let angle = 0
  try {
    angle = principalAngleDeg(mol.get_molblock())
  } catch {}
  const candidates = []
  try {
    for (const rotate of [-angle, 90 - angle]) {
      const raw = mol.get_svg_with_highlights(
        JSON.stringify({ width: 1400, height: 1400, fixedBondLength: bond, rotate })
      )
      if (!raw || !raw.includes('<svg')) continue
      const cropped = cropMoleculeSvg(raw)
      candidates.push({ ...cropped, rotate })
    }
  } finally {
    mol.delete()
  }
  if (!candidates.length) throw new Error('没有生成结构图')
  // 主惯性轴只允许水平/垂直；在两者里选横向宽度更小的
  candidates.sort((a, b) => {
    if (Math.abs(a.w - b.w) > 3) return a.w - b.w
    return a.h - b.h
  })
  const best = candidates[0]
  molCache.set(key, best)
  return best
}

`
j=j.slice(0,start)+block+j.slice(end)
fs.writeFileSync('public/chem.js',j)
let c=fs.readFileSync('public/style.css','utf8')
c=c.replace(".chem-rxn { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: nowrap; width: 100%; padding: 12px 4px; overflow-x: auto; }", ".chem-rxn { display: flex; align-items: stretch; justify-content: center; gap: 2px; flex-wrap: nowrap; width: 100%; padding: 12px 4px; overflow-x: auto; }")
c=c.replace(".chem-side { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: nowrap; flex: 0 0 auto; }", ".chem-side { display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: nowrap; flex: 0 0 auto; align-self: stretch; }")
c=c.replace(".chem-part svg { width: auto; height: auto; max-width: none; display: block; }", ".chem-part { display: flex; align-items: center; justify-content: center; }\n.chem-part svg { width: auto; height: auto; max-width: none; display: block; }")
fs.writeFileSync('public/style.css',c)
console.log('principal H/V + plus alignment', j.includes('90 - angle'), c.includes('align-self: stretch'))
