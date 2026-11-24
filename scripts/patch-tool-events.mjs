import fs from 'node:fs'

// llm: onTool 回调
for (const F of ['lib/llm.mjs', 'mobile/src/llm.js']) {
  let t = fs.readFileSync(F, 'utf8')
  t = t.replace(
    "  { signal, model, onReasoning, provider, tools, exec, maxRounds = 6 } = {}",
    "  { signal, model, onReasoning, provider, tools, exec, onTool, maxRounds = 6 } = {}"
  )
  if (!t.includes('onTool?.(')) {
    t = t.replace(
      "    for (const c of round.calls) {\n      let result",
      "    for (const c of round.calls) {\n      try {\n        onTool?.({ name: c.name, args: parseToolArgs(c.arguments) })\n      } catch {}\n      let result"
    )
  }
  fs.writeFileSync(F, t)
}

// mobile api: 把 tool 事件转发给前端
let m = fs.readFileSync('mobile/src/api.js', 'utf8')
m = m.replace(
  "          specs: TOOL_SPECS,\n          exec: (name, args) => execTool(docs, doc.id, name, args),",
  "          specs: TOOL_SPECS,\n          exec: (name, args) => execTool(docs, doc.id, name, args),\n          onTool: (t) => send({ type: 'tool', name: t.name, args: t.args }),"
)
fs.writeFileSync('mobile/src/api.js', m)

// server: tool SSE + 中止处理
let s = fs.readFileSync('server.mjs', 'utf8')
s = s.replace(
  "        exec: (name, args) => execTool(docs, doc.id, name, args),",
  "        exec: (name, args) => execTool(docs, doc.id, name, args),\n        onTool: (t) => sse({ type: 'tool', name: t.name, args: t.args }),"
)
s = s.replace(
  "  } catch (e) {\n    node.status = 'error'\n    node.error = String(e.message || e)\n    sse({ type: 'error', message: node.error })\n  }",
  `  } catch (e) {
    if (ac.signal.aborted || (e && e.name === 'AbortError')) {
      node.status = 'stopped'
      sse({ type: 'stopped' })
    } else {
      node.status = 'error'
      node.error = String(e.message || e)
      sse({ type: 'error', message: node.error })
    }
  }`
)
fs.writeFileSync('server.mjs', s)
console.log('tool events + abort handled')
