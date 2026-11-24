import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const doc = JSON.parse(fs.readFileSync(process.env.APPDATA + '/文档树/docs/18e087b051a3.json', 'utf8'))
const tree = { nodes: { p1: { id: 'p1', parentId: null, anchor: { kind: 'doc', page: 105, quote: 'x' }, question: 'q', answer: 'a' } } }
const sys = (node, tr = { nodes: {} }) => buildAskMessages({ docs: [doc], tree: tr, node })[0].content
const modes = {
  selection: sys({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: 'shape' }, question: 'q' }),
  page: sys({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: '' }, question: 'q' }),
  free: sys({ docId: doc.id, anchor: { kind: 'doc', page: 105, quote: '', free: true }, question: 'q' }),
  follow: sys({ docId: doc.id, parentId: 'p1', anchor: { kind: 'answer', nodeId: 'p1', quote: 'x', page: 105 }, question: 'q' }, tree)
}
const dup = (s) => (s.match(/read_page\(page, doc\?\)/g) || []).length
for (const [k, v] of Object.entries(modes)) {
  console.log(JSON.stringify({
    mode: k,
    len: v.length,
    selectionRule: v.includes('只解释选中的这段文字'),
    pageRule: v.includes('按页面内容展开'),
    freeRule: v.includes('问题范围由你判断'),
    followRule: v.includes('这是对上一条回答的追问'),
    toolMentions: dup(v),
    starts: v.split('\n')[0]
  }))
}
