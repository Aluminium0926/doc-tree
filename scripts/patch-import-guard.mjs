import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.replace(
  "import { extract, kindOf } from './lib/extract.mjs'",
  "import { extract, kindOf, SUPPORTED_EXT } from './lib/extract.mjs'"
)
s=s.replace(
`  if (p === '/api/import' && req.method === 'POST') {
    const name = decodeURIComponent(req.headers['x-filename'] || 'document')
    const buf = await readBody(req)
    const ext = path.extname(name).toLowerCase()`,
`  if (p === '/api/import' && req.method === 'POST') {
    const name = decodeURIComponent(req.headers['x-filename'] || 'document')
    const ext = path.extname(name).toLowerCase()
    if (!SUPPORTED_EXT.has(ext)) {
      return json(res, 415, { error: \`暂不支持 \${ext || '这个格式'}，目前支持 PDF / Word / Markdown / TXT / PPTX\` })
    }
    const buf = await readBody(req)`
)
fs.writeFileSync('server.mjs',s)
console.log('server guard ok')
