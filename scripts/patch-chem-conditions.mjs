import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
if(!j.includes('function cleanConditions')){
  j=j.replace("function parseBlock(kind, raw) {", `function cleanConditions(s) {
  let x = String(s || '')
  // 去掉括号里的机理/位置说明
  x = x.replace(/\\([^)]*(?:coupling|position|regio|mechanism|attack|favou?red|ortho|para|meta)[^)]*\\)/gi, '')
  // 去掉 ortho/para/meta 相关的解释性分句
  x = x.replace(/[^,;，；]*\\b(?:ortho|para|meta)\\b[^,;，；]*/gi, '')
  x = x.replace(/\\s{2,}/g, ' ').replace(/\\s*[,;，；]\\s*(?=[,;，；]|$)/g, '').trim()
  return x.replace(/^[,;，；\\s]+|[,;，；\\s]+$/g, '')
}

function parseBlock(kind, raw) {`)
}
j=j.replace("  let conditions = meta.condition || meta.conditions || ''", "  let conditions = cleanConditions(meta.condition || meta.conditions || '')")
j=j.replace("            if (!conditions) conditions = agents", "            if (!conditions) conditions = cleanConditions(agents)")
j=j.replace("          if (!conditions) conditions = agents", "          if (!conditions) conditions = cleanConditions(agents)")
fs.writeFileSync('public/chem.js',j)
let ctx=fs.readFileSync('lib/context.mjs','utf8')
ctx=ctx.replace("名称用 label:，箭头上方试剂用 reagents:，箭头下方条件用 conditions:；副产物也要写进产物；不要把 Cl-、Na+ 等旁观离子写进 reaction SMILES；SMILES 必须能被 RDKit 解析，不确定时宁可只给名称和文字。", "名称用 label:，箭头上方试剂用 reagents:，箭头下方条件用 conditions:；conditions 只写温度、pH、溶剂、催化剂等条件，最多 30 字，不要写 ortho/para/meta、机理解释或产物说明，这些放正文；副产物也要写进产物；不要把 Cl-、Na+ 等旁观离子写进 reaction SMILES；SMILES 必须能被 RDKit 解析，不确定时宁可只给名称和文字。")
fs.writeFileSync('lib/context.mjs',ctx)
console.log('conditions clean/prompt', j.includes('cleanConditions'), ctx.includes('不要写 ortho/para/meta'))
