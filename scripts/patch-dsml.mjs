import fs from 'node:fs'

const F = 'lib/llm.mjs'
let t = fs.readFileSync(F, 'utf8')

// ---------- DSML 工具标记解析 ----------
const helpers = `
// DeepSeek 等模型会把工具调用写成 <|DSML|invoke name="read_page"> ... 的文本
function stripDSML(s) {
  return String(s || '')
    .replace(/<[^>]*?invoke[^>]*?name\\s*=\\s*"[^"]*"[^>]*>[\\s\\S]*?<\\/[^>]*?invoke\\s*>/gi, '')
    .replace(/<[^>]*?DSML[^>]*>/gi, '')
    .replace(/<\\/[^>]*?DSML[^>]*>/gi, '')
    .replace(/<\\/?[^>]*?parameter[^>]*>/gi, '')
}

function visibleDSML(s) {
  const src = String(s || '')
  // 还没闭合的 DSML 段先不要显示
  const at = src.search(/<\\s*[|｜]\\s*[|｜]\\s*DSML/i)
  const head = at >= 0 ? src.slice(0, at) : src
  return stripDSML(head)
}

function parseDSMLCalls(s) {
  const calls = []
  const re = /<[^>]*?invoke[^>]*?name\\s*=\\s*"([^"]+)"[^>]*>([\\s\\S]*?)<\\/[^>]*?invoke\\s*>/gi
  for (const m of String(s || '').matchAll(re)) {
    const name = m[1]
    const input = {}
    const pre = /<[^>]*?parameter[^>]*?name\\s*=\\s*"([^"]+)"[^>]*>([\\s\\S]*?)<\\/[^>]*?parameter\\s*>/gi
    for (const p of m[2].matchAll(pre)) {
      input[p[1]] = p[2].trim()
    }
    if (!Object.keys(input).length && m[2].trim()) input._raw = m[2].trim()
    calls.push({ name, arguments: JSON.stringify(input) })
  }
  return calls
}
`
if (!t.includes('function parseDSMLCalls')) {
  t = t.replace('function parseToolArgs(s) {', helpers + '\nfunction parseToolArgs(s) {')
}

// ---------- openai 轮次：过滤 DSML、收集 DSML 调用 ----------
const s1 = t.indexOf("async function openaiToolRound(")
const e1 = t.indexOf("async function anthropicToolRound(", s1)
if (s1 < 0 || e1 < 0) throw new Error('openai round markers')
let seg = t.slice(s1, e1)

seg = seg.replace(
  "  let text = ''\n  const calls = []",
  "  let text = ''\n  let shown = ''\n  const calls = []\n  const emit = (full) => {\n    const vis = visibleDSML(full)\n    if (vis.length > shown.length) {\n      onDelta(vis.slice(shown.length))\n      shown = vis\n    }\n  }"
)
seg = seg.replace(
  "        if (delta.content) {\n          text += delta.content\n          onDelta(delta.content)\n        }",
  "        if (delta.content) {\n          text += delta.content\n          emit(text)\n        }"
)
seg = seg.replace(
  "  return { text, calls: calls.filter(Boolean) }",
  `  const dsml = parseDSMLCalls(text)
  const allCalls = [...calls.filter(Boolean), ...dsml]
  return { text: stripDSML(text), calls: allCalls }`
)
t = t.slice(0, s1) + seg + t.slice(e1)

fs.writeFileSync(F, t)
console.log('dsml parsing added')
