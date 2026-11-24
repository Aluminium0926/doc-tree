import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "        {\n          model: useModel,\n          provider,\n          onReasoning: (t) => {",
  "        {\n          model: useModel,\n          provider,\n          specs: TOOL_SPECS,\n          exec: (name, args) => execTool(docs, doc.id, name, args),\n          onReasoning: (t) => {"
)
fs.writeFileSync(F, t)
console.log(t.includes('specs: TOOL_SPECS') ? 'ok' : 'not matched')
