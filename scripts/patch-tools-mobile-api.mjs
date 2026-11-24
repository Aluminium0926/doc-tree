import fs from 'node:fs'
const F = 'mobile/src/api.js'
let t = fs.readFileSync(F, 'utf8')
t = t.replace("import { buildAskMessages, buildSummaryMessages, treeToMarkdown } from './context.mjs'", "import { buildAskMessages, buildSummaryMessages, treeToMarkdown, TOOL_SPECS, execTool } from './context.mjs'")
t = t.replace("import { chat, streamChat } from './llm.js'", "import { chat, streamChat, streamChatWithTools } from './llm.js'")
t = t.replace(
  `      await streamChat(
        messages,`,
  `      await streamChatWithTools(
        messages,`
)
t = t.replace(
  `        {
          signal: ac.signal,
          model: useModel,
          provider,
          onReasoning:`,
  `        {
          signal: ac.signal,
          model: useModel,
          provider,
          specs: TOOL_SPECS,
          exec: (name, args) => execTool(docs, doc.id, name, args),
          onReasoning:`
)
fs.writeFileSync(F, t)
console.log('mobile api wired')
