import fs from 'node:fs'
let t=fs.readFileSync('lib/llm.mjs','utf8')
t=t.replace(
  "{ signal, model, onReasoning, provider, tools, exec, onTool, maxRounds = 6, webSearch, onWebEvent, onSources } = {}",
  "{ signal, model, onReasoning, provider, tools, exec, onTool, maxRounds = 6, webSearch, onWebEvent, onSources, extraTools } = {}"
)
t=t.replace(
  "  const toolSpecs = toolSpecsFor(format)\n\n  if (webSearch) {",
  "  const extras = (extraTools || []).map((x) =>\n    format === 'anthropic'\n      ? { name: x.function.name, description: x.function.description, input_schema: x.function.parameters }\n      : x\n  )\n  const toolSpecs = [...toolSpecsFor(format), ...extras]\n\n  if (webSearch) {"
)
fs.writeFileSync('lib/llm.mjs',t)
console.log('extraTools support', t.includes('extraTools'))
