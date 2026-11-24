import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace('          model: useModel,\n          onReasoning:', '          model: useModel,\n          provider,\n          onReasoning:')
fs.writeFileSync(F, t)
console.log(t.includes('provider,\n          onReasoning:') ? 'ok' : 'not matched')
