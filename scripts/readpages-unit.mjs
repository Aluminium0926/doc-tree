import fs from 'node:fs'
import { TOOL_SPECS, execTool, splitChunks } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const doc = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const out = execTool([doc], doc.id, 'read_pages', { from: 1, to: 3 })
const chunks = splitChunks(doc)
console.log(JSON.stringify({
  tools: TOOL_SPECS.map(t => t.name),
  hasPage1: out.includes('[第1页]'),
  hasPage3: out.includes('[第3页]'),
  noPage4: !out.includes('[第4页]'),
  chunks: chunks.length,
  maxChunk: Math.max(...chunks.map(c => c.text.length))
}))
