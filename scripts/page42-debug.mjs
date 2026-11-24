import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const doc = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const s = JSON.stringify(buildAskMessages({ docs: [doc], tree: { nodes: {} }, node: { docId: doc.id, anchor: { kind: 'doc', page: 19, quote: '' }, question: '再讲到42页' } })).replace(/\\n/g, '\n')
const idx = s.indexOf('第42页')
console.log('idx', idx)
console.log(s.slice(Math.max(0, idx - 120), idx + 160))
console.log('markers', (s.match(/\[第\d+页\]/g) || []).slice(-5))
console.log('pages', doc.pages.length, 'first', doc.pages[0].no, 'last', doc.pages[doc.pages.length-1].no)
