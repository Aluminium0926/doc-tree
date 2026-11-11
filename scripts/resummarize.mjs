// 补生成某文档的摘要
import * as store from '../lib/store.mjs'
import * as llm from '../lib/llm.mjs'
import { buildSummaryMessages } from '../lib/context.mjs'

const id = process.argv[2]
const doc = await store.getDoc(id)
if (!doc) {
  console.error('文档不存在')
  process.exit(1)
}
console.log('文档:', doc.title, '| 原摘要:', (doc.summary || '').length, '字')
const s = await llm.chat(buildSummaryMessages(doc), { maxTokens: 700, effort: 'low' })
doc.summary = s.trim()
await store.saveDoc(doc)
console.log('新摘要:', doc.summary.length, '字')
console.log(doc.summary.slice(0, 300))
