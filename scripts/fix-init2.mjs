import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(/maybeWelcome\(\)\s*\r?\n\s*async function init\(\) \{/, 'async function init() {')
fs.writeFileSync(F, t)
console.log('ok')
