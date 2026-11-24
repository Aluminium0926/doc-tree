import fs from 'node:fs'
import { buildAskMessages, TOOL_SPECS } from '../lib/context.mjs'
const doc = JSON.parse(fs.readFileSync(process.env.APPDATA + '/文档树/docs/18e087b051a3.json', 'utf8'))
const tree = { nodes: {
  p1: { id: 'p1', parentId: null, anchor: { kind: 'doc', page: 105, quote: '原文' }, question: '上一问', answer: '上一答' }
} }
const base = { docId: doc.id, parentId: null }
const sel = buildAskMessages({ docs: [doc], tree: { nodes: {} }, node: { ...base, anchor: { kind: 'doc', page: 105, quote: 'shape' }, question: '这里什么意思' } })
const free = buildAskMessages({ docs: [doc], tree: { nodes: {} }, node: { ...base, anchor: { kind: 'doc', page: 105, quote: '', free: true }, question: '讲讲 broadcasting' } })
const follow = buildAskMessages({ docs: [doc], tree, node: { docId: doc.id, parentId: 'p1', anchor: { kind: 'answer', nodeId: 'p1', quote: '选中回答', page: 105 }, question: '为什么' } })
const text = (m) => Array.isArray(m.content) ? m.content.map(c => c.text || '').join('') : m.content
const fenced = (s) => '```text\n' + s.replace(/```/g, '``\u200b`') + '\n```'
const out = `# 上下文实际内容

## 工具定义（随每次请求发送）
\n${fenced(TOOL_SPECS.map(t => `${t.name}(${Object.keys(t.parameters.properties || {}).join(', ')}) — ${t.description}`).join('\n'))}

## 系统提示词（选中文字 / 讲解本页）
\n${fenced(text(sel[0]))}

## 用户消息（选中文字示例，第105页）
\n${fenced(text(sel[1]))}

## 自由提问（没选中文字）的系统提示词额外段
\n${fenced(text(free[0]))}

## 自由提问的用户消息
\n${fenced(text(free[1]))}

## 追问上一条回答的系统提示词额外段
\n${fenced(text(follow[0]))}

## 追问的用户消息
\n${fenced(text(follow[1]))}
`
fs.writeFileSync('context-report.md', out)
console.log('written', out.length)
