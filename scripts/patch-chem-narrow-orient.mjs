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
  const candidates = []
  try {
    for (const rotate of [0, 90]) {
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
  // 先按横向宽度最小选；宽度接近时优先 0°，保持更自然的横平
  candidates.sort((a, b) => {
    if (Math.abs(a.w - b.w) > 3) return a.w - b.w
    if (a.rotate !== b.rotate) return a.rotate - b.rotate
    return a.h - b.h
  })
  const best = candidates[0]
  molCache.set(key, best)
  return best
}

`
j=j.slice(0,start)+block+j.slice(end)
fs.writeFileSync('public/chem.js',j)
console.log('choose narrow 0/90', j.includes('for (const rotate of [0, 90])'))
