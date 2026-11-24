import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const doc = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const p42 = doc.pages.find(p => p.no === 42)
const p42text = (p42?.text || '').slice(0, 80)
const mk = (docs) => JSON.stringify(buildAskMessages({ docs, tree: { nodes: {} }, node: { docId: doc.id, anchor: { kind: 'doc', page: 19, quote: '' }, question: '再讲到42页，还是详细一点' } }))
const single = mk([doc])
const other = JSON.parse(fs.readFileSync(dir + '8687098beb7d.json', 'utf8'))
const group = mk([doc, other])
console.log(JSON.stringify({
  page42text: p42text,
  singleHas42: single.includes('[第42页]') && single.includes(p42text.trim().slice(0, 30)),
  singleHasFull: single.includes('全文】'),
  groupHas42: group.includes('[第42页]'),
  groupHasOther: group.includes(other.title)
}, null, 1))
