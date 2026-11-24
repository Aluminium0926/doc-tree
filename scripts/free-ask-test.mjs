import { buildAskMessages } from '../lib/context.mjs'
const doc = { id: 'd', title: 'T', summary: 'S', pages: [{ no: 1, text: 'P1' }, { no: 105, text: 'P105' }] }
const free = buildAskMessages({ docs: [doc], tree: { nodes: {} }, node: { docId: 'd', anchor: { kind: 'doc', page: 1, quote: '', free: true }, question: '讲讲 broadcasting' } })
const page = buildAskMessages({ docs: [doc], tree: { nodes: {} }, node: { docId: 'd', anchor: { kind: 'doc', page: 105, quote: '' }, question: '讲这页' } })
const f = JSON.stringify(free[1])
console.log(JSON.stringify({
  freeNoWholePage: !f.includes('讲解第 1 页的整页内容'),
  freeHasQuestion: f.includes('讲讲 broadcasting'),
  pageHasWhole: JSON.stringify(page[1]).includes('讲解第 105 页的整页内容')
}))
