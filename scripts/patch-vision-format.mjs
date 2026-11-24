import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.split('format: cfg.visionFormat }').join('format: cfg.visionFormat || cfg.apiFormat }')
s=s.split('format: cfg.visionFormat\n').join('format: cfg.visionFormat || cfg.apiFormat\n')
fs.writeFileSync('server.mjs',s)
console.log('vision format fallback ok')
