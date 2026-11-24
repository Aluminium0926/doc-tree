import { execTool } from '../lib/context.mjs'
import fs from 'node:fs'
const dir = process.env.APPDATA + '/文档树/docs/'
const doc = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const out = execTool([doc], doc.id, 'search_docs', { query: 'shape' })
console.log(JSON.stringify({ hasPrev: out.includes('上一页开头'), hasNext: out.includes('下一页开头'), len: out.length }))
