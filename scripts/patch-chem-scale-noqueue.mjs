import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')

// replace moleculeSvg + fitMolecule
const start=j.indexOf('async function moleculeSvg(source) {')
const end=j.indexOf('function reactionParts(info) {')
if(start<0||end<0) throw new Error('molecule block')
const block=`function cropMoleculeSvg(svg) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none'
  host.innerHTML = safeSvg(svg)
  document.body.appendChild(host)
  try {
    const el = host.querySelector('svg')
    if (!el) throw new Error('SVG 为空')
    const bg = el.querySelector(':scope > rect')
    if (bg) bg.remove()
    const bbox = el.getBBox()
    if (!bbox || !bbox.width || !bbox.height) throw new Error('结构图为空')
    const pad = 8
    const w = Math.ceil(bbox.width + pad * 2)
    const h = Math.ceil(bbox.height + pad * 2)
    el.setAttribute('viewBox', \`\${bbox.x - pad} \${bbox.y - pad} \${w} \${h}\`)
    el.setAttribute('width', String(w))
    el.setAttribute('height', String(h))
    return { svg: el.outerHTML, w, h }
  } finally {
    host.remove()
  }
}

async function moleculeSvg(source) {
  if (molCache.has(source)) return molCache.get(source)
  const rdkit = await getRDKit()
  const mol = rdkit.get_mol(source)
  if (!mol) throw new Error('SMILES 无法解析：' + source.slice(0, 60))
  const raw = mol.get_svg_with_highlights(
    JSON.stringify({ width: 800, height: 600, fixedBondLength: 20 })
  )
  mol.delete()
  if (!raw || !raw.includes('<svg')) throw new Error('没有生成结构图')
  const cropped = cropMoleculeSvg(raw)
  molCache.set(source, cropped)
  return cropped
}

function fitMolecule(svgEl, maxWidth = 460) {
  if (!svgEl) return
  svgEl.style.maxWidth = maxWidth + 'px'
  svgEl.style.height = 'auto'
}

`
j=j.slice(0,start)+block+j.slice(end)

// partsHtml svg objects
j=j.replace(
`function partsHtml(parts, svgs) {
  return parts
    .map((p, i) => \`\${i ? '<span class="chem-plus">+</span>' : ''}<span class="chem-part">\${safeSvg(svgs[i])}</span>\`)
    .join('')
}`,
`function partsHtml(parts, svgs) {
  return parts
    .map((p, i) => \`\${i ? '<span class="chem-plus">+</span>' : ''}<span class="chem-part">\${svgs[i].svg}</span>\`)
    .join('')
}`
)

// draw standalone use cropped
j=j.replace(
`    const svg = await moleculeSvg(info.source)
    if (!fig.isConnected) return
    canvas.innerHTML = safeSvg(svg)
    fitMolecule(canvas.querySelector('svg'), 440)`,
`    const item = await moleculeSvg(info.source)
    if (!fig.isConnected) return
    canvas.innerHTML = item.svg
    fitMolecule(canvas.querySelector('svg'), 460)`
)

// replace queue with direct render
const qs=j.indexOf('function enqueue(job) {')
const qe=j.indexOf('export function enhanceChemBlocks(root) {')
if(qs<0||qe<0) throw new Error('queue block')
j=j.slice(0,qs)+j.slice(qe)
j=j.replace("    enqueue(() => draw(fig, lang, info))", "    draw(fig, lang, info).catch(() => {})")
fs.writeFileSync('public/chem.js',j)
console.log('fixed bond/crop/noqueue', j.includes('fixedBondLength'), j.includes('cropMoleculeSvg'), !j.includes('queue.push'))
