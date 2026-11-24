import fs from 'node:fs'
let s = fs.readFileSync('server.mjs', 'utf8')

// 超时控制器
s = s.replace(
  "  const ac = new AbortController()\n  req.on('close', () => ac.abort())",
  "  const ac = new AbortController()\n  let timedOut = false\n  const timeout = setTimeout(() => {\n    timedOut = true\n    try {\n      ac.abort()\n    } catch {}\n  }, 120000)\n  req.on('close', () => ac.abort())"
)

// usage 返回 & 事件
s = s.replace(
  "    await llm.streamChatWithTools(",
  "    const usage = await llm.streamChatWithTools("
)
s = s.replace(
  "    node.status = 'done'\n  } catch (e) {",
  "    if (usage) {\n      node.usage = usage\n      sse({ type: 'usage', usage })\n    }\n    node.status = 'done'\n  } catch (e) {"
)
s = s.replace(
  "  } catch (e) {\n    if (ac.signal.aborted || (e && e.name === 'AbortError')) {",
  "  } catch (e) {\n    if (timedOut) {\n      node.status = 'error'\n      node.error = '请求超时（120 秒），已中止'\n      sse({ type: 'error', message: node.error })\n    } else if (ac.signal.aborted || (e && e.name === 'AbortError')) {"
)
s = s.replace(
  "  if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)",
  "  clearTimeout(timeout)\n  if (node.reasoning) node.reasoning = node.reasoning.slice(0, 6000)"
)
fs.writeFileSync('server.mjs', s)
console.log('server usage + timeout ok')
