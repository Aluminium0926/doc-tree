import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const doc = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const tree = { nodes: {} }
let prev = null
for (let i = 0; i < 8; i++) {
  tree.nodes['n' + i] = { id: 'n' + i, parentId: prev, anchor: { kind: 'doc', page: 10 + i, quote: 'q' }, question: '问题' + i, answer: '回答'.repeat(200) }
  prev = 'n' + i
}
const msgs = buildAskMessages({ docs: [doc], tree, node: { docId: doc.id, parentId: prev, anchor: { kind: 'doc', page: 20, quote: 'shape' }, question: '继续' } })
const user = msgs[1]._volatileText || ''
const chain = user.split('【本次追问所在的分支】')[1] || ''
console.log(JSON.stringify({
  chainLines: (chain.match(/^\d+\./gm) || []).length,
  relatedCount: (user.match(/【其他相关段落】/) ? (user.split('【其他相关段落】')[1].split('【')[0].match(/^- /gm) || []).length : 0),
  lastAnswerLong: (chain.match(/答：回答/g) || []).length ? chain.split('答：').pop().length > 700 : false
}))
