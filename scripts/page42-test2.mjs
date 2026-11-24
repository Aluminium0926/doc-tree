import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const small = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const big = JSON.parse(fs.readFileSync(dir + '70a7df39fee0.json', 'utf8'))
const mk = (docs, q) => JSON.stringify(buildAskMessages({ docs, tree: { nodes: {} }, node: { docId: docs[0].id, anchor: { kind: 'doc', page: 19, quote: '' }, question: q } }))
const s1 = mk([small], '再讲到42页，还是详细一点')
const s2 = mk([big], '再讲到42页，还是详细一点')
const s3 = mk([big, small], '42页和另一份文档的讲解')
console.log(JSON.stringify({
  smallFull: s1.includes('全文】'),
  smallHas42: s1.includes('第42页') && s1.includes('Array Indexing & Slicing'),
  bigFull: s2.includes('全文】'),
  bigHas42: s2.includes('[第42页]'),
  bigHasIndex: s2.includes('页面索引'),
  groupHas42: s3.includes('[第42页]'),
  groupHasIndex: s3.includes('页面索引'),
  lens: { s1: s1.length, s2: s2.length, s3: s3.length }
}, null, 1))
