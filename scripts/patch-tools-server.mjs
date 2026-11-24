import fs from 'node:fs'
const F = 'server.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "import { buildAskMessages, buildSummaryMessages, treeToMarkdown } from './lib/context.mjs'",
  "import { buildAskMessages, buildSummaryMessages, treeToMarkdown, execTool } from './lib/context.mjs'"
)
t = t.replace(
  "    await llm.streamChat(\n      messages,",
  "    await llm.streamChatWithTools(\n      messages,"
)
t = t.replace(
  "      {\n        signal: ac.signal,\n        model: useModel,\n        provider,\n        onReasoning:",
  "      {\n        signal: ac.signal,\n        model: useModel,\n        provider,\n        exec: (name, args) => execTool(docs, doc.id, name, args),\n        onReasoning:"
)
fs.writeFileSync(F, t)
console.log(t.includes('streamChatWithTools') && t.includes('exec: (name, args)') ? 'server wired' : 'check')
