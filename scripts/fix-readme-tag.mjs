import fs from 'node:fs'
let r = fs.readFileSync('README.md', 'utf8')
r = r.replace('[v1.0.4](https://github.com/Aluminium0926/doc-tree/releases/tag/v1.0.5)', '[v1.0.5](https://github.com/Aluminium0926/doc-tree/releases/tag/v1.0.5)')
fs.writeFileSync('README.md', r)
console.log('ok')
