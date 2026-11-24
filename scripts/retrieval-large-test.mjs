import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const d = JSON.parse(fs.readFileSync(dir + 'f359e20128f1.json', 'utf8'))
const build = (q) => JSON.stringify(buildAskMessages({ docs: [d], tree: { nodes: {} }, node: { docId: d.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: q } }))
const a = build('讲讲神经元的动作电位')
const b = build('第42页讲了什么')
const count = (s) => (s.match(/\[第\d+页\]/g) || []).length
console.log(JSON.stringify({
  full: a.includes('全文】'),
  index: a.includes('页面索引'),
  selectedPagesA: count(a),
  selectedPagesB: count(b),
  has42: b.includes('[第42页]'),
  lenA: a.length, lenB: b.length
}, null, 1))
