import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const doc = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const withInstr = { ...doc, instructions: ['回答用中文'] }
const tree = { nodes: { p: { id: 'p', parentId: null, anchor: { kind: 'doc', page: 43, quote: '' }, question: 'q', answer: 'a' } } }
const mk = (node, docs = [doc]) => buildAskMessages({ docs, tree, node })
const sel = mk({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: 'shape' }, question: 'q' })
const page = mk({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: '' }, question: 'q' })
const free = mk({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: '', free: true }, question: 'q' })
const follow = mk({ docId: doc.id, parentId: 'p', anchor: { kind: 'answer', nodeId: 'p', quote: 'x', page: 43 }, question: 'q' })
const instr = mk({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: 'shape' }, question: 'q' }, [withInstr])
const sys = (m) => m[0].content
const user = (m) => JSON.stringify(m[1].content)
console.log(JSON.stringify({
  sameSystem: sys(sel) === sys(page) && sys(page) === sys(free) && sys(free) === sys(follow),
  staticNoTitle: !sys(sel).includes(doc.title),
  modesInUser: [sel, page, free, follow].map(m => user(m).includes('【本轮要求】')),
  instructionInUser: user(instr).includes('用户附加指令') && user(instr).includes('回答用中文'),
  instructionNotInSystem: !sys(instr).includes('回答用中文')
}, null, 1))
