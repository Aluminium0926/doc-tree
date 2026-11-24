import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
if(!a.includes("from './chem.js'")){
  a=a.replace("import { marked } from './vendor/marked.esm.js'", "import { marked } from './vendor/marked.esm.js'\nimport { enhanceChemBlocks } from './chem.js'")
}
a=a.replace("  enhanceCodeBlocks(sheet)", "  enhanceChemBlocks(sheet)\n  enhanceCodeBlocks(sheet)")
a=a.replace("  ans.innerHTML = renderMarkdown(n.answer || '')\n  enhanceCodeBlocks(ans)", "  ans.innerHTML = renderMarkdown(n.answer || '')\n  enhanceChemBlocks(ans)\n  enhanceCodeBlocks(ans)")
fs.writeFileSync('public/app.js',a)

let c=fs.readFileSync('public/style.css','utf8')
if(!c.includes('.chem-figure')){
  c += `
/* 化学结构 / 反应式 */
.chem-figure { margin: 14px 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; }
.chem-canvas { padding: 10px 8px 2px; display: flex; justify-content: center; align-items: center; min-height: 120px; overflow-x: auto; }
.chem-canvas svg { max-width: 100%; height: auto; display: block; }
.chem-loading { color: #8a94a6; font-size: 12px; padding: 26px; }
.chem-error { color: #b42318; font-size: 12px; padding: 4px 20px 8px; text-align: center; }
.chem-canvas pre { width: 100%; margin: 0; padding: 10px 14px; background: #f6f7fb; color: #333; font-size: 11px; overflow: auto; }
.chem-cap { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid #edf0f5; color: #556070; font-size: 11.5px; }
.chem-label { font-weight: 600; color: #263140; }
.chem-cond { color: #7a8494; }
.chem-copy { margin-left: auto; border: 1px solid #dde2ea; background: #fff; color: #6b7484; border-radius: 999px; padding: 2px 9px; font-size: 10.5px; cursor: pointer; }
.chem-copy:hover { border-color: var(--accent); color: var(--accent-deep); }
`
  fs.writeFileSync('public/style.css',c)
}

let s=fs.readFileSync('server.mjs','utf8')
if(!s.includes("'.wasm': 'application/wasm'")){
  s=s.replace("  '.bcmap': 'application/octet-stream',", "  '.bcmap': 'application/octet-stream',\n  '.wasm': 'application/wasm',")
  fs.writeFileSync('server.mjs',s)
}

let ctx=fs.readFileSync('lib/context.mjs','utf8')
if(!ctx.includes('smiles')){
  ctx=ctx.replace(
    "- 如果用户消息附带截图，结合图中的图表、公式和排版回答；截图与文字层冲突时以截图为准。",
    "- 如果用户消息附带截图，结合图中的图表、公式和排版回答；截图与文字层冲突时以截图为准。\n- 需要画分子结构或有机反应时，用围栏代码块：语言写 smiles 或 reaction；结构式写 SMILES，反应式写 reaction SMILES（反应物>>产物）；名称用 label: 一行，试剂/温度用 conditions: 一行。不要用 ASCII 字符画结构。"
  )
  fs.writeFileSync('lib/context.mjs',ctx)
}
console.log('chem integration patches ok', a.includes('enhanceChemBlocks'), c.includes('.chem-figure'), s.includes("'.wasm'"), ctx.includes('smiles'))
