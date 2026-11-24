import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const doc = JSON.parse(fs.readFileSync(process.env.APPDATA + '/文档树/docs/18e087b051a3.json', 'utf8'))
const node = { anchor: { kind: 'doc', page: 19, quote: '' }, question: '讲解本页内容' }
const msgs = buildAskMessages({ doc, tree: { nodes: {} }, node })
const text = JSON.stringify(msgs)
console.log(JSON.stringify({
  hasPageLabel: text.includes('第 19 页，本页内容'),
  hasMainText: text.includes('The main() function'),
  hasAsk: text.includes('请讲解第 19 页'),
  len: text.length
}))
