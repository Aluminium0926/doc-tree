import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const d = JSON.parse(fs.readFileSync(process.env.APPDATA + '/文档树/docs/18e087b051a3.json', 'utf8'))
const msgs = buildAskMessages({ docs: [d], tree: { nodes: {} }, node: { docId: d.id, anchor: { kind: 'doc', page: 7, quote: '', free: true }, question: 'shape 的  和 1 分别是什么意思' } })
const s = JSON.stringify(msgs)
console.log(JSON.stringify({
  freeHint: s.includes('没有选中文字'),
  noPageBody: !s.includes('第 7 页，本页内容'),
  systemSearch: s.includes('主动调用 search_docs'),
  len: s.length
}))
