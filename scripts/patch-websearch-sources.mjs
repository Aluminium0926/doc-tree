import fs from 'node:fs'
let s=fs.readFileSync('server.mjs','utf8')
s=s.replace(
  "          node.sources = (Array.isArray(list) ? list : [])\n            .map((a) => ({ url: a.url, title: a.title || a.url }))\n            .filter((a) => a.url)",
  "          node.sources = (Array.isArray(list) ? list : [])\n            .map((a) => {\n              const c = a.url_citation || a\n              return { url: c.url, title: c.title || c.url }\n            })\n            .filter((a) => a.url)"
)
fs.writeFileSync('server.mjs',s)
let c=fs.readFileSync('lib/context.mjs','utf8')
c=c.replace(
  "if (webSearch) volatile.push('【本轮已开启联网搜索】需要最新信息时可以直接联网搜索并阅读链接；本轮不能调用本地文档工具。回答涉及网上信息时请标注来源。')",
  "if (webSearch) volatile.push('【本轮已开启联网搜索】用户明确要求联网。请先调用 deepseek_web_search 检索并阅读链接，再结合结果回答；即使问题看起来和文档有关，也要用搜索核实外部事实。本轮不能调用本地文档工具。回答涉及网上信息时请标注来源。')"
)
fs.writeFileSync('lib/context.mjs',c)
let a=fs.readFileSync('mobile/src/api.js','utf8')
a=a.replace(
  "            node.sources = (Array.isArray(list) ? list : []).map((x) => ({ url: x.url, title: x.title || x.url })).filter((x) => x.url)",
  "            node.sources = (Array.isArray(list) ? list : []).map((x) => { const c2 = x.url_citation || x; return { url: c2.url, title: c2.title || c2.url } }).filter((x) => x.url)"
)
fs.writeFileSync('mobile/src/api.js',a)
console.log('source mapping + prompt ok')
