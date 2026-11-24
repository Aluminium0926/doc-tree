import { buildAskMessages } from '../lib/context.mjs'
const doc = { id: 'd', title: 'T', summary: 'S', pages: [{ no: 1, text: 'P1' }, { no: 43, text: 'P43' }] }
const tree = { nodes: { p: { id: 'p', parentId: null, anchor: { kind: 'doc', page: 43, quote: '' }, question: 'Q', answer: 'A' } } }
const node = { docId: 'd', parentId: 'p', anchor: { kind: 'answer', nodeId: 'p', quote: '', page: 43 }, question: '为什么' }
const msgs = buildAskMessages({ docs: [doc], tree, node })
const s = JSON.stringify(msgs)
console.log(JSON.stringify({
  noWholePageAsk: !s.includes('讲解第 43 页的整页内容') && !s.includes('讲解第 1 页的整页内容'),
  hasFollowLead: s.includes('继续追问上一条回答'),
  chain: s.includes('答：A'),
  followSystem: msgs[0].content.includes('这是对上一条回答的追问')
}))
