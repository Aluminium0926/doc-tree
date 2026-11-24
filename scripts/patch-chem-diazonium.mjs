import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')

// normalization
if(!j.includes('function normalizeSmiles')){
  j=j.replace("function looksLikeSmiles(s) {", `function normalizeSmiles(s) {
  return String(s || '')
    .replace(/\\[N\\+\\]#N(?=[A-Za-z\\[\\(])/g, 'N#[N+]')
    .replace(/\\[N\\+\\]#N-/g, 'N#[N+]-')
}

function looksLikeSmiles(s) {`)
}
j=j.replace("  if (!source) source = body.join(' ')\n  source = source.replace(/\\s+/g, '').trim()", "  if (!source) source = body.join(' ')\n  source = normalizeSmiles(source).replace(/\\s+/g, '').trim()")

// partial component rendering
j=j.replace("function partsHtml(parts, svgs) {\n  return parts\n    .map((p, i) => `${i ? '<span class=\"chem-plus\">+</span>' : ''}<span class=\"chem-part\">${svgs[i].svg}</span>`)\n    .join('')\n}", `function partsHtml(parts, svgs) {
  return parts
    .map((p, i) => {
      const s = svgs[i]
      const body = s && s.svg ? s.svg : `<span class="chem-part-error" title="${esc(p)}">SMILES 无法解析</span>`
      return `${i ? '<span class="chem-plus">+</span>' : ''}<span class="chem-part">${body}</span>`
    })
    .join('')
}`)
j=j.replace(
`  const [leftSvgs, rightSvgs] = await Promise.all([
    Promise.all(r.left.map((s) => moleculeSvg(s, 26))),
    Promise.all(r.right.map((s) => moleculeSvg(s, 26)))
  ])`,
`  const safe = async (s) => {
    try {
      return await moleculeSvg(s, 26)
    } catch (e) {
      return { error: String(e.message || e), source: s }
    }
  }
  const [leftSvgs, rightSvgs] = await Promise.all([
    Promise.all(r.left.map(safe)),
    Promise.all(r.right.map(safe))
  ])`
)
j=j.replace("  fig.dataset.state = 'done'\n}\n\nasync function draw", "  fig.dataset.state = [...leftSvgs, ...rightSvgs].some((x) => x.error) ? 'partial' : 'done'\n}\n\nasync function draw")
fs.writeFileSync('public/chem.js',j)
console.log('normalize/partial', j.includes('normalizeSmiles'), j.includes('chem-part-error'), j.includes("'partial'"))
