import { buildAskMessages } from '../lib/context.mjs'
const doc = {
  id: 'd1', title: '测试文档', summary: '摘要',
  pages: [
    { no: 1, text: 'PAGE-ONE-COVER 封面内容' },
    { no: 105, text: 'PAGE-105 真正的上下文内容' }
  ]
}
const tree = { nodes: {
  p1: { id: 'p1', parentId: null, anchor: { kind: 'doc', page: 105, quote: '原文' }, question: '上一问', answer: '上一答' }
} }
const node = { docId: 'd1', parentId: 'p1', anchor: { kind: 'answer', nodeId: 'p1', quote: '选中回答文字' }, question: '为什么？' }
const msgs = buildAskMessages({ docs: [doc], tree, node })
const s = JSON.stringify(msgs)
console.log(JSON.stringify({
  hint105: s.includes('上一条基于第 105 页'),
  noPageOneBody: !s.includes('PAGE-ONE-COVER'),
  has105: s.includes('第 105 页'),
  followSystem: s.includes('追问上一条回答'),
  chain: s.includes('上一答')
}))
