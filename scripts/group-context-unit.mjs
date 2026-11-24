import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).slice(0, 2)
const docs = files.map(f => JSON.parse(fs.readFileSync(dir + f, 'utf8')))
const node = { anchor: { kind: 'doc', page: 1, quote: '' }, question: '讲解本页内容' }
const msgs = buildAskMessages({ docs, tree: { nodes: {} }, node })
const s = JSON.stringify(msgs)
console.log(JSON.stringify({
  hasGroup: s.includes('文档组（共 2 份'),
  hasBoth: docs.every(d => s.includes(d.title)),
  hasAnchorAsk: s.includes('请讲解《' + docs.find(d => d.id === node.docId || true).title + '》') || s.includes('请讲解《')
}))
