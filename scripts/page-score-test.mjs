import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const big = JSON.parse(fs.readFileSync(dir + '70a7df39fee0.json', 'utf8'))
const s = JSON.stringify(buildAskMessages({ docs: [big], tree: { nodes: {} }, node: { docId: big.id, anchor: { kind: 'doc', page: 1, quote: '' }, question: '讲讲定积分的应用，比如旋转体体积怎么算' } }))
const hits = (s.match(/"第\d+页/g) || []).length
console.log(JSON.stringify({ len: s.length, pagesIncluded: hits, hasVolume: s.includes('体积') || s.includes('volume') }))
