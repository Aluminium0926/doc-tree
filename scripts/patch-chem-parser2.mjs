import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace(
`function looksLikeSmiles(s) {
  const x = String(s || '').trim()
  if (!x) return false
  if (x.includes('>>') || x.includes('>')) return true
  return /(\\[[^\\]]+\\]|[BCNOPSFI][a-z]?[0-9]?|[cnops](?=[0-9])|[=#()])/.test(x)
}`,
`function looksLikeSmiles(s) {
  const x = String(s || '').trim()
  if (!x) return false
  if (x.includes('>>') || x.includes('>')) return true
  if (/[,\\s]/.test(x)) return false
  if (/^[A-Za-z][a-z]{2,}$/.test(x)) return false
  if (/[\\[\\]=#()]/.test(x)) return true
  if (/[cnops][0-9]/.test(x)) return true
  return /^[A-Za-z0-9@+\\-\\[\\]()=#\\\\/.]+$/.test(x) && /^[A-Z]/.test(x) && !/^[A-Z][a-z]{2,}/.test(x)
}`
)
fs.writeFileSync('public/chem.js',j)
let c=fs.readFileSync('lib/context.mjs','utf8')
c=c.replace(
"- 需要画分子结构或有机反应时，用围栏代码块：语言写 smiles 或 reaction；结构式写 SMILES，反应式写 reaction SMILES（反应物>>产物）；名称用 label: 一行，试剂/温度用 conditions: 一行。不要用 ASCII 字符画结构。",
"- 需要画分子结构或有机反应时，用围栏代码块：语言写 smiles 或 reaction；结构式写 SMILES，反应式必须用一行 reaction: 写标准 reaction SMILES（反应物>>产物），不要拆成 reactants:/reagents:/products: 字段；名称用 label:，试剂/温度用 conditions:。不要用 ASCII 字符画结构。"
)
fs.writeFileSync('lib/context.mjs',c)
console.log('parser heuristic/prompt', j.includes('looksLikeSmiles'), c.includes('不要拆成'))
