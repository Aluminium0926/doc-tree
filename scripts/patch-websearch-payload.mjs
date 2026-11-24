import fs from 'node:fs'
let t=fs.readFileSync('lib/llm.mjs','utf8')
t=t.replace(
  "async function openaiToolRound(cfg, key, base, messages, tools, { signal, model, onDelta, onReasoning }) {",
  "async function openaiToolRound(cfg, key, base, messages, tools, { signal, model, onDelta, onReasoning, webSearch, onWebEvent, onSources }) {"
)
t=t.replace(
  "  if (tools.length) {\n    body.tools = tools\n    body.tool_choice = 'auto'\n  }",
  "  if (webSearch) {\n    body.tools = [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }]\n  } else if (tools.length) {\n    body.tools = tools\n    body.tool_choice = 'auto'\n  }"
)
fs.writeFileSync('lib/llm.mjs',t)
console.log('payload web tools ok')
