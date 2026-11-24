import fs from 'node:fs'
import { buildAskMessages } from '../lib/context.mjs'
const dir = process.env.APPDATA + '/文档树/docs/'
const a = JSON.parse(fs.readFileSync(dir + '18e087b051a3.json', 'utf8'))
const b = JSON.parse(fs.readFileSync(dir + '8687098beb7d.json', 'utf8'))
const msgs = buildAskMessages({ docs: [a, b], tree: { nodes: {} }, node: { docId: a.id, anchor: { kind: 'doc', page: 1, quote: '', free: true }, question: '对比两份文档' } })
const s = msgs[0].content
console.log(JSON.stringify({
  groupRole: s.includes('放进同一个组'),
  groupRule: s.includes('跨文档对照'),
  bothTitles: s.includes(a.title) && s.includes(b.title),
  toolsOnce: (s.match(/read_page\(page, doc\?\)/g) || []).length === 1,
  modeFree: s.includes('问题范围由你判断')
}))
