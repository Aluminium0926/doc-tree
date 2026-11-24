import fs from 'node:fs'
let e=fs.readFileSync('lib/extract.mjs','utf8')
e=e.replace(
  "export const SUPPORTED_EXT = new Set(['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx'])",
  "export const SUPPORTED_EXT = new Set(['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt', '.pptx', '.ppt'])"
)
fs.writeFileSync('lib/extract.mjs',e)

let s=fs.readFileSync('server.mjs','utf8')
s=s.replace(
  "import { renderPageImage } from './lib/render.mjs'",
  "import { renderPageImage } from './lib/render.mjs'\nimport { pptToPdf } from './lib/office.mjs'"
)
s=s.replace(
`    const { kind, pages } = await extract(buf, ext)
    const id = crypto.randomBytes(6).toString('hex')
    await store.saveFile(id, ext, buf)`,
`    let sourceBuf = buf
    let sourceExt = ext
    if (ext === '.ppt' || ext === '.pptx') {
      try {
        sourceBuf = await pptToPdf(buf, ext)
        sourceExt = '.pdf'
      } catch (e) {
        if (ext === '.ppt') {
          return json(res, 415, { error: '这个 .ppt 转换失败：' + String(e.message || e).slice(0, 160) + '。可以先用 PowerPoint 另存为 PDF 再导入。' })
        }
        // pptx 转换失败时退回纯文字提取
      }
    }
    const { kind, pages } = await extract(sourceBuf, sourceExt)
    const id = crypto.randomBytes(6).toString('hex')
    await store.saveFile(id, sourceExt, sourceBuf)`
)
s=s.replace(
      "      ext,\n      pages,",
      "      ext: sourceExt,\n      pages,"
)
s=s.replace(
      "      bytes: buf.length,",
      "      bytes: sourceBuf.length,"
)
fs.writeFileSync('server.mjs',s)
console.log('office conversion server ok')
